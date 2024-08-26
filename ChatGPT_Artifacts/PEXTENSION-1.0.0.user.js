// ==UserScript==
// @name         PEXTENSION
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Add PREVIEW button as a hover action on code blocks in ChatGPT responses with draggable panel. Currently support python, html, css, js.
// @match        https://chatgpt.com/*
// @grant        GM_addElement
// @grant        GM_addStyle
// ==/UserScript==
(function() {
    'use strict';

    let panel;
    let isDragging = false;
    let startX;
    let startWidth;
    let necessaryPacks = ['numpy', 'matplotlib'];

    function isWebLang(codeBlock) {
    const languageClass = codeBlock.querySelector('.language-html, .language-css, .language-javascript');
    return languageClass !== null;
}

    function isPython(codeBlock) {
    const languageClass = codeBlock.querySelector('.language-python');
    return languageClass !== null;
}

    function createSlideOutPanel(codeBlock) {
        if (panel) {
            panel.remove();
        }

        panel = document.createElement('div');
        panel.style.cssText = `
            position: fixed;
            top: 0;
            right: 0;
            width: 600px; /* Initial width */
            height: 100%;
            background: #f7f7f8;
            box-shadow: -2px 0 10px rgba(0,0,0,0.3);
            z-index: 1000;
            display: flex;
            flex-direction: column;
            transform: translateX(100%);
            transition: transform 0.3s ease-in-out;
            border-radius: 8px 0 0 8px;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            padding: 15px;
            background: #343a40;
            color: #fff;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
            border-radius: 8px 0 0 0;
            font-weight: bold;
        `;

        const title = document.createElement('div');
        title.textContent = 'VISUALCGPT PEXTENSION';
        title.style.cssText = `
            font-size: 18px;
            font-weight: bold;
            color: #00dbde;
            letter-spacing: 1px;
            text-transform: uppercase;
            background: linear-gradient(135deg, #fc00ff, #00dbde);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        `;
        header.appendChild(title);

        const closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        closeButton.style.cssText = `
            background: linear-gradient(135deg, #fc00ff, #00dbde); /* Gradient background */
            border: none;
            border-radius: 50%; /* Make the button circular */
            width: 30px;
            height: 30px;
            cursor: pointer;
            color: #343a40; /* Match the header background color */
            font-weight: bold;
            font-size: 18px;
            text-align: center;
            line-height: 28px;
            transition: box-shadow 0.3s ease-in-out, transform 0.3s ease-in-out;
        `;
        closeButton.onmouseover = () => {
            closeButton.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.6)';
            closeButton.style.transform = 'scale(1.1)';
        };
        closeButton.onmouseleave = () => {
            closeButton.style.boxShadow = 'none';
            closeButton.style.transform = 'scale(1)';
        };
        closeButton.onclick = () => panel.style.transform = 'translateX(100%)';

        header.appendChild(closeButton);
        header.style.justifyContent = 'space-between'; // Align title to the left and button to the right
        panel.appendChild(header);

        const contentContainer = document.createElement('div');
        contentContainer.style.cssText = `
            padding: 20px;
            overflow-y: auto;
            flex-grow: 1;
            font-weight: bold;
        `;

        const iframe = document.createElement('iframe');
        iframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            margin: 0;
            padding: 0;
            border-radius: 0 0 8px 0;
        `;
        contentContainer.appendChild(iframe);
        panel.appendChild(contentContainer);

        // Append the panel to the body
        document.body.appendChild(panel);

        // Clone the code block and remove the "Run Demo" button
        const cleanCodeBlock = codeBlock.cloneNode(true);
        const runDemoButton = cleanCodeBlock.querySelector('.run-demo-hover-button');
        if (runDemoButton) {
            runDemoButton.remove();
        }

        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        if (isWebLang(codeBlock)) doc.write(cleanCodeBlock.textContent);
        else {
            const pythonCode = cleanCodeBlock.textContent;
            doc.write(`
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Run Python Code</title>
    <link rel="stylesheet" href="https://pyscript.net/latest/pyscript.css" />
    <script defer src="https://pyscript.net/latest/pyscript.js"></script>

    <py-config>
        packages = []
    </py-config>

</head>
<body>
    <h1></h1>

<py-script>
import asyncio
import micropip
from pyodide.ffi import create_proxy
from pyscript import Element

async def install_packages():
    # Tìm các phần tử HTML để hiển thị kết quả
    output_div = Element('output')

    # Hiển thị thông báo cài đặt thư viện
    output_div.write("Installing necessary packages...", append=True)

    src = ${JSON.stringify(pythonCode)}
    necessaryPacks = ${JSON.stringify(necessaryPacks)}
    for pack in necessaryPacks:
        if pack in src:
            await micropip.install(pack)

    # Vẽ biểu đồ matplotlib
    if 'import matplotlib' in src:
        import matplotlib.pyplot as plt
        fig, ax = plt.subplots()

${pythonCode.split('\n').map(line => `    ${line}`).join('\n')}

    # Hiển thị biểu đồ trên trang web
    if 'import matplotlib' in src:
        output_div.write(fig, append=True)

    output_div.write("EXECUTE SUCCESSFULLY <3", append=True)

async def main():
    await install_packages()

# Lên lịch thực thi coroutine main
asyncio.ensure_future(main())
</py-script>

<div id="output"></div>


</body>
</html>
        `);

        }
        doc.close();

        setTimeout(() => panel.style.transform = 'translateX(0)', 0);

        // Add event listeners for resizing the panel
        panel.addEventListener('mousedown', startDragging);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDragging);

        // Close the panel if clicking outside of it
        document.addEventListener('click', function(event) {
            if (!panel.contains(event.target) && !event.target.closest('.run-demo-hover-button')) {
                panel.style.transform = 'translateX(100%)';
            }
        }, { once: true });
    }

    function startDragging(e) {
        isDragging = true;
        startX = e.clientX;
        startWidth = parseInt(document.defaultView.getComputedStyle(panel).width, 10);
    }

    function drag(e) {
        if (!isDragging) return;
        const width = startWidth - (e.clientX - startX);
        panel.style.width = `${width}px`;
    }

    function stopDragging() {
        isDragging = false;
    }

    function addHoverButton(codeBlock) {
        if (!(isWebLang(codeBlock) || isPython(codeBlock))) return;

        if (!codeBlock.querySelector('.run-demo-hover-button')) {
            const hoverButton = document.createElement('button');
            if (isWebLang(codeBlock)) hoverButton.textContent = 'PREVIEW UI';
            else hoverButton.textContent = 'EXECUTE CODE';
            hoverButton.className = 'run-demo-hover-button';
            hoverButton.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                padding: 8px 16px;
                background: linear-gradient(135deg, #fc00ff, #00dbde);
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                display: none;
                z-index: 1000;
                transition: box-shadow 0.3s ease-in-out, transform 0.3s ease-in-out;
                font-weight: bold;
            `;
            hoverButton.onmouseover = () => {
                hoverButton.style.boxShadow = '0 4px 15px rgba(0, 219, 222, 0.6)';
                hoverButton.style.transform = 'scale(1.05)';
            };
            hoverButton.onmouseleave = () => {
                hoverButton.style.boxShadow = 'none';
                hoverButton.style.transform = 'scale(1)';
            };
            hoverButton.onclick = (e) => {
                e.stopPropagation();
                createSlideOutPanel(codeBlock);
            };

            codeBlock.style.position = 'relative';
            codeBlock.appendChild(hoverButton);

            codeBlock.addEventListener('mouseenter', () => {
                hoverButton.style.display = 'block';
            });

            codeBlock.addEventListener('mouseleave', () => {
                hoverButton.style.display = 'none';
            });
        }
    }

    function processCodeBlocks() {
        const codeBlocks = document.querySelectorAll('.overflow-y-auto');
        codeBlocks.forEach(codeBlock => {
            if (codeBlock.closest('.markdown')) {
                addHoverButton(codeBlock);
            }
        });
    }

    function observeChat() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const codeBlocks = node.querySelectorAll('.overflow-y-auto');
                            codeBlocks.forEach(codeBlock => {
                                if (codeBlock.closest('.markdown')) {
                                    addHoverButton(codeBlock);
                                }
                            });
                        }
                    });
                }
            });
        });

        const chatContainer = document.querySelector('main');
        if (chatContainer) {
            observer.observe(chatContainer, { childList: true, subtree: true });
        }
    }

    function addIndicator() {
        const indicator = document.createElement('div');
        indicator.textContent = 'Code Block Processor Active';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
            padding: 8px 16px;
            background: linear-gradient(135deg, #fc00ff, #00dbde);
            color: white;
            border-radius: 5px;
            font-size: 14px;
            font-weight: bold;
            transition: opacity 0.5s ease-in-out;
        `;
        document.body.appendChild(indicator);
        setTimeout(() => indicator.style.opacity = '0', 3000);
    }

    function initializeProcessor() {
        addIndicator();
        processCodeBlocks();
        observeChat();
    }

    // Use MutationObserver to wait for the chat interface to load
    const bodyObserver = new MutationObserver((mutations) => {
        if (document.querySelector('main')) {
            bodyObserver.disconnect();
            initializeProcessor();
        }
    });

    bodyObserver.observe(document.body, { childList: true, subtree: true });
})();
