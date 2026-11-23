# Облачная история и перенос со старого домена

Для Worker-аккаунтов история хранится в D1 через `https://api.reyhoho.fun`.
Настройка Telegram и D1 описана в [worker-telegram.md](worker-telegram.md).
Гостевая история хранится локально. Выход отключает доступ к истории аккаунта.

Импорт объединяет записи, сохраняя существующие данные и отметки удаления.
Лимит истории один везде — 5000 записей (`HISTORY_CAPACITY` в
`shared/history-data.js`): гостевая история, мост, файл и квота D1 по активным
записям. GET отдаёт страницы по 1000 с `nextCursor`. Импорт идёт пакетами
не больше 40 записей и ~390 КБ; что не поместилось в квоту, не откатывает пакет,
а возвращается как `rejected`, и клиент показывает, сколько записей не перенесено.
Объединение сверх лимита не обрезает историю молча, а просит удалить лишнее.
При удалении метаданные стираются, ID сохраняется, чтобы старый импорт не
восстановил удалённый фильм. Для полного стирания администратор удаляет записи
аккаунта из `user_history` и `history_quota`; после этого старый импорт сможет
восстановить фильмы.

Новые просмотры и удаления аккаунта сначала попадают в локальную очередь
(`src/utils/historyOutbox.js`, ключ `reyohoho-history-outbox:<owner>`), затем
отправляются. Запись удаляется из очереди только после 2xx или ответа, который
нельзя повторить (400/404/409/413). Каждый снимок с сервера накладывается на
очередь, поэтому обновление не стирает неотправленный просмотр. Очередь
повторяется при следующей загрузке истории, и время просмотра сохраняется
(`viewedAt`, не старше 90 дней). Более старый повтор не сдвигает новую запись
назад. Синхронизации позиции видео нет.
История и bearer-токены не должны попадать в общий cache, URL или логи.

Для прежнего backend опциональная D1-история включается отдельно через
`VITE_CLOUD_HISTORY_ENABLED=true` и согласие пользователя. В локальной
конфигурации Worker требуется `HISTORY_AUTH_USER_URL`: фиксированный доверенный
HTTPS `/user`, возвращающий `{id}` для действительного токена и 401/403 для
недействительного. Этот вариант не переносит остальные списки в D1.

## Перенос с GitHub Pages

Старый origin — `https://dav2010id.github.io`, новый — `https://reyhoho.fun`.
localStorage разделён по origin, а не пути. Новый сайт не может прочитать старое
хранилище напрямую. Старый `/reyohoho/` перенаправляет на custom domain, поэтому
страница переноса размещается отдельно, сохраняя старый origin.
Она опубликована на https://dav2010id.github.io/reyohoho-history-transfer/
из отдельного репозитория `dav2010ID/reyohoho-history-transfer`.
Исходники в основном проекте: `migration/history-transfer/`.
Изменения этих файлов не обновляют мост автоматически: нужно синхронизировать
четыре файла в отдельном репозитории.

### Повторное развёртывание моста

1. Создать в аккаунте dav2010id отдельный репозиторий `reyohoho-history-transfer`.
2. Скопировать `index.html`, `transfer.js`, `style.css` из `migration/history-transfer/`
   и `shared/history-data.js` в корень сайта переноса. В публикуемой копии `transfer.js`
   заменить импорт `../../shared/history-data.js` на `./history-data.js`.
3. Включить GitHub Pages из корня ветки. Не задавать custom domain и CNAME.
4. Проверить URL `https://dav2010id.github.io/reyohoho-history-transfer/`:
   он должен открываться без перенаправления на новый домен. Если у
   пользовательского сайта GitHub Pages тоже задан custom domain, проектные
   сайты могут его наследовать; сначала нужно обеспечить доступ на старом origin.

На reyhoho.fun открыть Настройки → Поведение → «Перенести со старого сайта»
в том же браузере и профиле, где использовался старый сайт. Popup покажет число
фильмов. Пользователь нажимает «Перенести на reyhoho.fun» и подтверждает импорт
на новом сайте. Для Worker-аккаунта записи добавляются в D1, для гостя — локально.
Импорт в прежний аккаунт использует его backend. Существующие записи сохраняются.
Если вместе с текущими записями выходит больше 5000, импорт не выполняется, и
пользователь видит, сколько записей нужно удалить.
На главной странице до 9 ноября 2026 (UTC) показывается неброская кнопка переноса.
Она открывает модальное окно с инструкциями, popup и импортом JSON без перехода
в настройки. Окно закрывается крестиком, Escape или нажатием на фон; история
при закрытии не меняется. Начатый перенос остаётся в окне при повторном открытии.
После окончания первого месяца перенос остаётся доступным в настройках.

Принимающая страница проверяет точный origin, окно-отправитель и одноразовый nonce.
Передаются только разрешённые поля истории; auth store и настройки не читаются.
Исходная история не удаляется. На странице переноса не должно быть аналитики и
сторонних скриптов. Полностью скрытый перенос без действий пользователя не
предусмотрен; явное подтверждение предотвращает импорт чужой истории.

Запасной вариант: открыть страницу переноса напрямую, скачать JSON и выбрать
«Импорт JSON» на новом сайте. Файл можно перенести на другое устройство.
Очищенную браузером историю, данные другого профиля или incognito восстановить
через этот механизм нельзя. История, которая существовала только в прежнем
backend, требует отдельного экспорта из того аккаунта.

## Active-entry quota migration

Deploy migration `0004_active_history_quota.sql` before the updated account Worker.
It recalculates counters and atomically limits active history to 5000. Deleting
an entry frees capacity; restoring a deleted entry checks capacity again. Import
continues to honor tombstones. List import uses POST /api/list/:type/import,
up to 40 items and 64 KiB per request (the client splits by UTF-8 bytes),
inserts only what fits under the 1000-item list capacity and reports the rest as
`rejected`; a full list answers 409 `{error:"list_capacity"}`. Existing entries
are never overwritten and duplicate IDs collapse. Retrying a batch is safe.

## Viewing statuses and the login switch

`watching`, `completed` and `abandoned` are mutually exclusive: a PUT to one
removes the title from the other two in the same D1 batch, and import skips a
title that already has a status. Rows that conflicted before this change are not
migrated; the next status click resolves them.

`TELEGRAM_AUTH_ENABLED` gates only NEW logins (token, poll, webhook). Existing
`rh1_` sessions, lists, history and logout keep working while it is `false`,
as long as `HISTORY_DB` is bound.
