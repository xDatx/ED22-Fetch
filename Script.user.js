// ==UserScript==
// @name         Tìm đáp án đúng
// @namespace    http://tampermonkey.net/
// @version      2025-08-28
// @description  Skibidi diddy whatever ts is
// @author       Ptit lỏ quá :(
// @match        https://ed22.engdis.com/Runtime/learningArea.html*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    window.myBearerToken = localStorage.getItem('myBearerToken') || null;
    window.hasFetchedModifiedUrl = false;
    window.processedItemId = null;
    window.lastProcessedUrl = null;

    const urlPattern = /https:\/\/edwebservices2\.engdis\.com\/api\/practiceManager\/GetItem\/(\d+)\/[a-zA-Z]\d+[a-zA-Z0-9_]+\/\d+\/0\/[1-9]+\/\?_=\d+/;
    const answerBoxId = 'auto-answer-box';

    // Hàm hiển thị đáp án lên giao diện trang web
    function displayAnswerOnPage(answers) {
        let answerBox = document.getElementById(answerBoxId);
        if (!answerBox) {
            answerBox = document.createElement('div');
            answerBox.id = answerBoxId;
            answerBox.style.position = 'fixed';
            answerBox.style.top = '10px';
            answerBox.style.right = '10px';
            answerBox.style.zIndex = '9999';
            answerBox.style.padding = '10px';
            answerBox.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            answerBox.style.color = '#fff';
            answerBox.style.border = '1px solid #4CAF50';
            answerBox.style.borderRadius = '5px';
            answerBox.style.fontFamily = 'Arial, sans-serif';
            answerBox.style.fontSize = '16px';
            document.body.appendChild(answerBox);
        }
        answerBox.textContent = `Đáp án: ${answers.join(' / ')}`;
    }

    // Hàm xóa hộp đáp án
    function clearAnswerDisplay() {
        const answerBox = document.getElementById(answerBoxId);
        if (answerBox) {
            answerBox.remove();
        }
    }

    // Hàm kiểm tra xem có đang ở chế độ "Test" không
    function isTestMode() {
        const stepElement = document.querySelector('div[title*="Test"]');
        return stepElement;
    }

    // Hàm chính để fetch và xử lý dữ liệu
    async function fetchAndProcessAnswers(originalUrl) {
        if (!window.myBearerToken) {
            console.error('Không có Bearer token. Vui lòng đợi trang web tải xong.');
            return;
        }

        const modifiedUrl = originalUrl.replace(/\/0\/(\d+)\/\?_=/, (match, p1) => {
            if (p1 === '2') {
                return '/0/6/?_=';
            }
            return match;
        });

        console.log(`URL đã sửa đổi: ${modifiedUrl}`);

        try {
            const response = await fetch(modifiedUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${window.myBearerToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Dữ liệu lấy được từ URL đã sửa đổi:', data);

            // Xử lý và hiển thị đáp án
            const allCorrectAnswers = [];
            if (!data.i && !data.i.d && !Array.isArray(data.i.d)) {
                data.i.d.forEach(item => {
                    if (item.txt) {
                        allCorrectAnswers.push(item.txt);
                    }
                });
            } else if (data.i && data.i.q && Array.isArray(data.i.q) && data.i.q.length > 0) {
                 for (let i = 0; i < data.i.q.length; i++) {
                    const q = data.i.q[i];
                    if (q.al && Array.isArray(q.al)) {
                        q.al.forEach(item => {
                            if (item.a && Array.isArray(item.a)) {
                                const c1Answers = item.a.filter(opt => opt.c === "1").map(opt => opt.txt);
                                c1Answers.forEach(txt => allCorrectAnswers.push(txt));
                                if (c1Answers.length === 0 && item.a.length > 0) {
                                     item.a.forEach(opt => {
                                         if (opt.txt) {
                                             allCorrectAnswers.push(opt.txt);
                                         }
                                     });
                                }
                            }
                        });
                    }
                 }
            }

            if (allCorrectAnswers.length > 0) {
                const uniqueAnswers = [...new Set(allCorrectAnswers)];
                console.log("Đáp án đúng:", uniqueAnswers.join(" / "));
                displayAnswerOnPage(uniqueAnswers);
            } else {
                console.log("Không tìm thấy đáp án đúng nào.");
                displayAnswerOnPage(['Không có đáp án']);
            }
        } catch(error) {
            console.error(`Đã xảy ra lỗi khi fetch URL đã sửa đổi: ${error}`);
        }
    }

    // Ghi đè phương thức setRequestHeader của XMLHttpRequest để lấy token
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
        if (header === 'Authorization' && value.startsWith('Bearer ')) {
            const token = value.substring(7);
            if (window.myBearerToken !== token) {
                window.myBearerToken = token;
                localStorage.setItem('myBearerToken', token);
                console.log(`Bearer token đã được cập nhật (XHR): ${window.myBearerToken}`);
            }
        }
        originalSetRequestHeader.apply(this, arguments);
    };

    // Ghi đè phương thức open của XMLHttpRequest
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        if (typeof url === 'string' && urlPattern.test(url) && url !== window.lastProcessedUrl) {
            window.lastProcessedUrl = url;
            fetchAndProcessAnswers(url);
        }
        originalXhrOpen.apply(this, [method, url, ...args]);
    };

    // Ghi đè phương thức fetch
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
        const url = input instanceof Request ? input.url : input;
        if (typeof url === 'string' && urlPattern.test(url) && url !== window.lastProcessedUrl) {
            window.lastProcessedUrl = url;
            fetchAndProcessAnswers(url);
        }

        if (init && init.headers) {
            const headers = new Headers(init.headers);
            const authHeader = headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                if (window.myBearerToken !== token) {
                    window.myBearerToken = token;
                    localStorage.setItem('myBearerToken', token);
                    console.log(`Bearer token đã được cập nhật (fetch): ${window.myBearerToken}`);
                }
            }
        }
        return originalFetch.apply(this, arguments);
    };

    const targetNode = document.body;
    const config = { childList: true, subtree: true };

    const observer = new MutationObserver(function(mutationsList, observer) {
        const isCurrentlyTestMode = isTestMode();
        if (!isCurrentlyTestMode) {
            clearAnswerDisplay();
        }
    });

    observer.observe(targetNode, config);

    console.log('Userscript đã được kích hoạt và sẵn sàng.');

})();
