// ==UserScript==
// @name           ReYoPlayer
// @namespace      https://github.com/VsevkaD/Scripts4Tempermonkey
// @version        1.0.2
// @description    Скрипт возвращает, немного другой, плеер на сайт ReYo

// @author         vsevkad
// @author         нейрослоп

// @updateURL      https://raw.githubusercontent.com/VsevkaD/Scripts4Tempermonkey/main/ReYo-CX.user.js
// @downloadURL    https://raw.githubusercontent.com/VsevkaD/Scripts4Tempermonkey/main/ReYo-CX.user.js

// @match          https://reyohoho.github.io/*
// @match          https://reyohoho.github.io/reyohoho/*
// @match          https://reyohoho.serv00.net/*
// @match          https://reyohoho.onrender.com/*

// ==/UserScript==

/*
Changelog:
1.0.1 - Изменил отображение для телефонов.
1.0.2 - Добавил адрес.
*/

(function() {
    'use strict';

    let lastId = null;
    let iframe = null;

    function createOrUpdatePlayer(filmId) {
        const target = document.querySelector(
            "#app > div.router-view-container > div > div > div > div.additional-info"
        );
        if (!target) return false;

        if (!iframe) {
            iframe = document.createElement("iframe");
            iframe.id = "kp";
            iframe.setAttribute("data-kinopoisk", filmId);
            iframe.allowFullscreen = true;

            // Ширина
            if (window.innerWidth <= 768) // мобильная версия, <= 768px
            {
                iframe.style.width = "100%";
            }
            else
            {
                iframe.style.width = "65%";
            }

            iframe.style.height = "auto";
            iframe.style.aspectRatio = "16 / 9";
            iframe.style.display = "block";
            iframe.style.margin = "10px auto";

            iframe.style.border = "2px solid rgba(24,24,24,1)";
            iframe.style.borderRadius = "16px";

            target.insertAdjacentElement("afterend", iframe);
        }

        iframe.src = "https://ddbb.lol?id=" + filmId + "&n=0";
        iframe.setAttribute("data-kinopoisk", filmId);
        return true;
    }

    function checkFilmPage() {
        const match = location.href.match(/movie\/(\d+)/);
        if (!match) {
            if (iframe) {
                iframe.remove();
                iframe = null;
            }
            lastId = null;
            return;
        }

        const filmId = match[1];
        if (filmId === lastId) return;
        lastId = filmId;

        if (!createOrUpdatePlayer(filmId)) {
            const observer = new MutationObserver((mutations, obs) => {
                if (createOrUpdatePlayer(filmId)) {
                    obs.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            checkFilmPage();
        }
    });
    urlObserver.observe(document, { subtree: true, childList: true });

    checkFilmPage();
})();
