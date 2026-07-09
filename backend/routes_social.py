from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from sanic import Blueprint, Request
from sanic.response import json
from sqlalchemy import case, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import auth_required, moderator_required
from .errors import APIError
from .models import (
    Comment,
    CommentVote,
    Movie,
    Rating,
    TimingReport,
    TimingSubmission,
    TimingVote,
    User,
)
from .routes_core import as_utc_iso, body, clean_id, limiter, list_item


bp = Blueprint("persistent_social")
TIME_RANGE = re.compile(r"(?<!\d)(\d{1,3}):(\d{2}):(\d{2})\s*-\s*(\d{1,3}):(\d{2}):(\d{2})(?!\d)")
MODERATION_STATES = {"approve": "approved", "reject": "rejected", "clean_text": "clean_text"}


def sanitize_text(value: Any, *, minimum: int, maximum: int, label: str) -> str:
    text = str(value or "").strip()
    if not minimum <= len(text) <= maximum:
        raise APIError(
            "VALIDATION_ERROR", f"{label} должен содержать от {minimum} до {maximum} символов", 422
        )
    return text


def validate_timing_text(value: Any) -> str:
    text = sanitize_text(value, minimum=11, maximum=2000, label="Тайминг")
    ranges: list[tuple[int, int]] = []
    for match in TIME_RANGE.finditer(text):
        sh, sm, ss, eh, em, es = map(int, match.groups())
        if sm >= 60 or ss >= 60 or em >= 60 or es >= 60:
            raise APIError("INVALID_TIMING", "Минуты и секунды должны быть меньше 60", 422)
        start = sh * 3600 + sm * 60 + ss
        end = eh * 3600 + em * 60 + es
        if start >= end:
            raise APIError("INVALID_TIMING", "Начало диапазона должно быть меньше конца", 422)
        ranges.append((start, end))
    if not ranges:
        raise APIError("INVALID_TIMING", "Ожидается диапазон HH:MM:SS-HH:MM:SS", 422)
    ordered = sorted(ranges)
    if any(current[0] < previous[1] for previous, current in zip(ordered, ordered[1:])):
        raise APIError("INVALID_TIMING", "Диапазоны не должны пересекаться", 422)
    return text


async def comment_rows(session: AsyncSession, movie_id: str, user_id: int | None):
    vote_total = func.coalesce(func.sum(CommentVote.rating), 0)
    user_vote = func.coalesce(
        func.max(case((CommentVote.user_id == user_id, CommentVote.rating), else_=None)), 0
    )
    query = (
        select(Comment, User, Rating.rating, vote_total.label("vote_total"), user_vote.label("user_vote"))
        .join(User, User.id == Comment.user_id)
        .outerjoin(Rating, (Rating.user_id == Comment.user_id) & (Rating.kp_id == Comment.movie_id))
        .outerjoin(CommentVote, CommentVote.comment_id == Comment.id)
        .where(Comment.movie_id == movie_id)
        .group_by(Comment.id, User.id, Rating.rating)
        .order_by(Comment.created_at.asc())
    )
    return (await session.execute(query)).all()


def comment_json(row) -> dict[str, Any]:
    comment, user, movie_rating, vote_total, user_vote = row
    return {
        "id": comment.id,
        "movie_id": comment.movie_id,
        "user_id": comment.user_id,
        "parent_id": comment.parent_id,
        "name": user.name,
        "user_avatar": user.photo,
        "user_movie_rating": movie_rating,
        "content": "" if comment.is_deleted else comment.content,
        "rating": int(vote_total or 0),
        "user_rating": int(user_vote or 0),
        "is_deleted": comment.is_deleted,
        "created_at": as_utc_iso(comment.created_at),
        "updated_at": as_utc_iso(comment.updated_at),
        "replies": [],
    }


async def timing_vote_payload(session: AsyncSession, timing_id: int, user_id: int | None) -> dict[str, Any]:
    timing = await session.get(TimingSubmission, timing_id)
    if timing is None or timing.is_deleted:
        raise APIError("TIMING_NOT_FOUND", "Тайминг не найден", 404)
    upvotes, downvotes = (
        await session.execute(
            select(
                func.count(case((TimingVote.vote_type == "upvote", 1))),
                func.count(case((TimingVote.vote_type == "downvote", 1))),
            ).where(TimingVote.timing_id == timing_id)
        )
    ).one()
    user_vote = None
    if user_id is not None:
        user_vote = await session.scalar(
            select(TimingVote.vote_type).where(
                TimingVote.timing_id == timing_id, TimingVote.user_id == user_id
            )
        )
    return {
        "upvotes": int(upvotes or 0),
        "downvotes": int(downvotes or 0),
        "vote_score": int(upvotes or 0) - int(downvotes or 0),
        "user_vote": user_vote,
    }


async def timing_json(session: AsyncSession, timing: TimingSubmission, user_id: int | None) -> dict[str, Any]:
    user = await session.get(User, timing.user_id)
    votes = await timing_vote_payload(session, timing.id, user_id)
    approved_count = await session.scalar(
        select(func.count(TimingSubmission.id)).where(
            TimingSubmission.user_id == timing.user_id,
            TimingSubmission.status == "approved",
            TimingSubmission.is_deleted.is_(False),
        )
    )
    return {
        "id": timing.id,
        "kp_id": timing.kp_id,
        "user_id": timing.user_id,
        "username": user.name if user else "",
        "user_timing_count": int(approved_count or 0),
        "timing_text": timing.timing_text,
        "status": timing.status,
        "upvotes": votes["upvotes"],
        "downvotes": votes["downvotes"],
        "voteScore": votes["vote_score"],
        "userVote": votes["user_vote"],
        **votes,
        "created_at": as_utc_iso(timing.created_at),
        "updated_at": as_utc_iso(timing.updated_at),
    }


async def get_comments(request: Request, movie_id: str):
    movie_id = clean_id(movie_id, "movieId")
    user = getattr(request.ctx, "user", None)
    records = [comment_json(row) for row in await comment_rows(request.ctx.db, movie_id, user.id if user else None)]
    by_id = {item["id"]: item for item in records}
    roots = []
    for item in records:
        parent = by_id.get(item["parent_id"])
        if parent is None:
            roots.append(item)
        else:
            parent["replies"].append(item)
    return json(roots)


@auth_required
async def create_comment(request: Request, movie_id: str):
    movie_id = clean_id(movie_id, "movieId")
    limiter.check(f"comment:{request.ctx.user.id}", 10, 60)
    payload = body(request)
    content = sanitize_text(payload.get("content"), minimum=1, maximum=1500, label="Комментарий")
    if not request.ctx.user.allow_comments:
        raise APIError("COMMENTS_DISABLED", "Пользователю запрещено оставлять комментарии", 403)
    parent_id = payload.get("parent_id")
    if parent_id is not None:
        if type(parent_id) is not int:
            raise APIError("INVALID_PARENT", "parent_id должен быть целым числом или null", 422)
        parent = await request.ctx.db.get(Comment, parent_id)
        if parent is None or parent.movie_id != movie_id:
            raise APIError("INVALID_PARENT", "Родительский комментарий не найден в этом фильме", 422)
        if parent.parent_id is not None:
            parent_id = parent.parent_id
    comment = Comment(
        movie_id=movie_id, user_id=request.ctx.user.id, parent_id=parent_id, content=content
    )
    request.ctx.db.add(comment)
    await request.ctx.db.commit()
    await request.ctx.db.refresh(comment)
    rows = await comment_rows(request.ctx.db, movie_id, request.ctx.user.id)
    return json(next(comment_json(row) for row in rows if row[0].id == comment.id), status=201)


@auth_required
async def update_comment(request: Request, comment_id: int):
    comment = await request.ctx.db.get(Comment, comment_id)
    if comment is None or comment.is_deleted:
        raise APIError("COMMENT_NOT_FOUND", "Комментарий не найден", 404)
    if comment.user_id != request.ctx.user.id and request.ctx.user.role not in {"moderator", "admin"}:
        raise APIError("FORBIDDEN", "Нельзя изменить чужой комментарий", 403)
    comment.content = sanitize_text(body(request).get("content"), minimum=1, maximum=1500, label="Комментарий")
    await request.ctx.db.commit()
    return json({"id": comment.id, "content": comment.content, "updated_at": as_utc_iso(comment.updated_at)})


@auth_required
async def delete_comment(request: Request, comment_id: int):
    comment = await request.ctx.db.get(Comment, comment_id)
    if comment is None:
        raise APIError("COMMENT_NOT_FOUND", "Комментарий не найден", 404)
    if comment.user_id != request.ctx.user.id and request.ctx.user.role not in {"moderator", "admin"}:
        raise APIError("FORBIDDEN", "Нельзя удалить чужой комментарий", 403)
    comment.is_deleted = True
    comment.content = ""
    await request.ctx.db.commit()
    return json({"deleted": True})


@bp.route("/comments/<identifier:str>", methods={"GET", "POST", "PUT", "DELETE"})
async def comments_crud(request: Request, identifier: str):
    if request.method == "GET":
        return await get_comments(request, identifier)
    if request.method == "POST":
        return await create_comment(request, identifier)
    try:
        comment_id = int(identifier)
    except ValueError as exc:
        raise APIError("VALIDATION_ERROR", "commentId должен быть целым числом", 422) from exc
    if request.method == "PUT":
        return await update_comment(request, comment_id)
    return await delete_comment(request, comment_id)


@bp.post("/comments/<comment_id:int>/rate")
@auth_required
async def rate_comment(request: Request, comment_id: int):
    limiter.check(f"comment-vote:{request.ctx.user.id}", 60, 60)
    value = body(request).get("rating")
    if value not in {-1, 1}:
        raise APIError("INVALID_VOTE", "rating должен быть -1 или 1", 422)
    comment = await request.ctx.db.get(Comment, comment_id)
    if comment is None or comment.is_deleted:
        raise APIError("COMMENT_NOT_FOUND", "Комментарий не найден", 404)
    vote = await request.ctx.db.scalar(
        select(CommentVote).where(
            CommentVote.comment_id == comment_id, CommentVote.user_id == request.ctx.user.id
        )
    )
    if vote is not None and vote.rating == value:
        await request.ctx.db.delete(vote)
        user_rating = 0
    elif vote is None:
        request.ctx.db.add(CommentVote(comment_id=comment_id, user_id=request.ctx.user.id, rating=value))
        user_rating = value
    else:
        vote.rating = value
        user_rating = value
    await request.ctx.db.commit()
    total = await request.ctx.db.scalar(
        select(func.coalesce(func.sum(CommentVote.rating), 0)).where(CommentVote.comment_id == comment_id)
    )
    return json({"rating": int(total or 0), "user_rating": user_rating})


@auth_required
async def create_timing(request: Request, kp_id: str):
    kp_id = clean_id(kp_id, "kpId")
    limiter.check(f"timing:{request.ctx.user.id}", 10, 3600)
    timing = TimingSubmission(
        kp_id=kp_id,
        user_id=request.ctx.user.id,
        timing_text=validate_timing_text(body(request).get("timing_text")),
        status="pending",
    )
    request.ctx.db.add(timing)
    await request.ctx.db.commit()
    await request.ctx.db.refresh(timing)
    return json(await timing_json(request.ctx.db, timing, request.ctx.user.id), status=201)


@auth_required
async def update_timing(request: Request, timing_id: int):
    timing = await request.ctx.db.get(TimingSubmission, timing_id)
    if timing is None or timing.is_deleted:
        raise APIError("TIMING_NOT_FOUND", "Тайминг не найден", 404)
    moderator = request.ctx.user.role in {"moderator", "admin"}
    if timing.user_id != request.ctx.user.id and not moderator:
        raise APIError("FORBIDDEN", "Нельзя изменить чужой тайминг", 403)
    if not moderator and timing.status not in {"pending", "approved"}:
        raise APIError("TIMING_LOCKED", "Этот тайминг нельзя изменить", 409)
    timing.timing_text = validate_timing_text(body(request).get("timing_text"))
    if not moderator:
        timing.status = "pending"
        timing.moderator_id = None
        timing.moderated_at = None
    await request.ctx.db.commit()
    return json(await timing_json(request.ctx.db, timing, request.ctx.user.id))


@auth_required
async def delete_timing(request: Request, timing_id: int):
    timing = await request.ctx.db.get(TimingSubmission, timing_id)
    if timing is None or timing.is_deleted:
        raise APIError("TIMING_NOT_FOUND", "Тайминг не найден", 404)
    if timing.user_id != request.ctx.user.id and request.ctx.user.role not in {"moderator", "admin"}:
        raise APIError("FORBIDDEN", "Нельзя удалить чужой тайминг", 403)
    timing.is_deleted = True
    await request.ctx.db.commit()
    return json({"deleted": True})


@bp.route("/timings/<identifier:str>", methods={"POST", "PUT", "DELETE"})
async def timings_crud(request: Request, identifier: str):
    if request.method == "POST":
        return await create_timing(request, identifier)
    try:
        timing_id = int(identifier)
    except ValueError as exc:
        raise APIError("VALIDATION_ERROR", "timingId должен быть целым числом", 422) from exc
    if request.method == "PUT":
        return await update_timing(request, timing_id)
    return await delete_timing(request, timing_id)


@bp.post("/timings/<timing_id:int>/report")
@auth_required
async def report_timing(request: Request, timing_id: int):
    timing = await request.ctx.db.get(TimingSubmission, timing_id)
    if timing is None or timing.is_deleted:
        raise APIError("TIMING_NOT_FOUND", "Тайминг не найден", 404)
    report_text = sanitize_text(body(request).get("report_text"), minimum=3, maximum=1000, label="Жалоба")
    existing = await request.ctx.db.scalar(
        select(TimingReport.id).where(
            TimingReport.timing_id == timing_id,
            TimingReport.user_id == request.ctx.user.id,
            TimingReport.status == "open",
        )
    )
    if existing is not None:
        raise APIError("REPORT_EXISTS", "Открытая жалоба уже существует", 409)
    request.ctx.db.add(
        TimingReport(timing_id=timing_id, user_id=request.ctx.user.id, report_text=report_text)
    )
    await request.ctx.db.commit()
    return json({"reported": True}, status=201)


@bp.get("/timings/<timing_id:int>/vote")
async def get_timing_vote(request: Request, timing_id: int):
    user = getattr(request.ctx, "user", None)
    return json(await timing_vote_payload(request.ctx.db, timing_id, user.id if user else None))


@bp.post("/timings/<timing_id:int>/vote")
@auth_required
async def vote_timing(request: Request, timing_id: int):
    vote_type = body(request).get("vote_type")
    if vote_type not in {"upvote", "downvote"}:
        raise APIError("INVALID_VOTE", "vote_type должен быть upvote или downvote", 422)
    timing = await request.ctx.db.get(TimingSubmission, timing_id)
    if timing is None or timing.is_deleted:
        raise APIError("TIMING_NOT_FOUND", "Тайминг не найден", 404)
    vote = await request.ctx.db.scalar(
        select(TimingVote).where(
            TimingVote.timing_id == timing_id, TimingVote.user_id == request.ctx.user.id
        )
    )
    if vote is not None and vote.vote_type == vote_type:
        await request.ctx.db.delete(vote)
    elif vote is None:
        request.ctx.db.add(
            TimingVote(timing_id=timing_id, user_id=request.ctx.user.id, vote_type=vote_type)
        )
    else:
        vote.vote_type = vote_type
    try:
        await request.ctx.db.commit()
    except IntegrityError as exc:
        await request.ctx.db.rollback()
        raise APIError("VOTE_CONFLICT", "Конкурентное обновление голоса", 409) from exc
    return json(await timing_vote_payload(request.ctx.db, timing_id, request.ctx.user.id))


@bp.get("/timings/top")
async def timings_top(request: Request):
    rows = (
        await request.ctx.db.execute(
            select(User.id, User.name, func.count(TimingSubmission.id).label("approved_count"))
            .join(TimingSubmission, TimingSubmission.user_id == User.id)
            .where(TimingSubmission.status == "approved", TimingSubmission.is_deleted.is_(False))
            .group_by(User.id, User.name)
            .order_by(func.count(TimingSubmission.id).desc())
            .limit(100)
        )
    ).all()
    return json(
        {"submissions": [{"user_id": row.id, "username": row.name, "approved_count": row.approved_count} for row in rows]}
    )


@bp.get("/timings/all")
@moderator_required
async def timings_all(request: Request):
    status = str(request.args.get("status") or "").strip()
    if status and status not in {"pending", "approved", "rejected", "clean_text"}:
        raise APIError("INVALID_STATUS", "Некорректный статус", 422)
    try:
        page = max(1, int(request.args.get("page") or 1))
        limit = min(100, max(1, int(request.args.get("limit") or 50)))
    except ValueError as exc:
        raise APIError("VALIDATION_ERROR", "page и limit должны быть числами", 422) from exc
    query = select(TimingSubmission).where(TimingSubmission.is_deleted.is_(False))
    if status:
        query = query.where(TimingSubmission.status == status)
    timings = list(
        (
            await request.ctx.db.scalars(
                query.order_by(TimingSubmission.created_at.desc()).offset((page - 1) * limit).limit(limit)
            )
        ).all()
    )
    return json(
        {"timings": [await timing_json(request.ctx.db, item, request.ctx.user.id) for item in timings], "page": page, "limit": limit}
    )


@bp.post("/timings/submission/<timing_id:int>/<action:str>")
@moderator_required
async def moderate_timing(request: Request, timing_id: int, action: str):
    status = MODERATION_STATES.get(action)
    if status is None:
        raise APIError("INVALID_MODERATION_ACTION", "Неизвестное действие модерации", 404)
    now = datetime.now(timezone.utc)
    result = await request.ctx.db.execute(
        update(TimingSubmission)
        .where(
            TimingSubmission.id == timing_id,
            TimingSubmission.status == "pending",
            TimingSubmission.is_deleted.is_(False),
        )
        .values(status=status, moderator_id=request.ctx.user.id, moderated_at=now)
    )
    if result.rowcount != 1:
        exists = await request.ctx.db.get(TimingSubmission, timing_id)
        if exists is None or exists.is_deleted:
            raise APIError("TIMING_NOT_FOUND", "Тайминг не найден", 404)
        raise APIError("INVALID_STATE_TRANSITION", "Тайминг уже обработан", 409)
    await request.ctx.db.commit()
    timing = await request.ctx.db.get(TimingSubmission, timing_id)
    return json(await timing_json(request.ctx.db, timing, request.ctx.user.id))


@bp.get("/discussed/<kind:str>")
async def discussed(request: Request, kind: str):
    if kind not in {"hot", "new", "movie", "series", "anime"}:
        raise APIError("INVALID_DISCUSSION_TYPE", "Неизвестный тип discussed", 422)
    try:
        page = max(1, int(request.args.get("page") or 1))
        limit = min(100, max(1, int(request.args.get("limit") or 20)))
    except ValueError as exc:
        raise APIError("VALIDATION_ERROR", "page и limit должны быть числами", 422) from exc
    score = func.count(Comment.id)
    query = (
        select(Comment.movie_id, score.label("score"))
        .where(Comment.is_deleted.is_(False))
        .group_by(Comment.movie_id)
        .order_by((func.max(Comment.created_at).desc() if kind == "new" else score.desc()))
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = (await request.ctx.db.execute(query)).all()
    ids = [row.movie_id for row in rows]
    movies = {
        movie.kp_id: movie
        for movie in (await request.ctx.db.scalars(select(Movie).where(Movie.kp_id.in_(ids)))).all()
    } if ids else {}
    return json([list_item(item, movies[item].metadata_json if item in movies else None) for item in ids])
