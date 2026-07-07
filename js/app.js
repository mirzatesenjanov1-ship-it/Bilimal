document.addEventListener("DOMContentLoaded", () => {
    // Жалпы Маалыматтар жана Симуляция Объектилери (Firebase сымал өндүрүштүк катмар)
    const DB = {
        currentTeacher: { id: "t_01", name: "Физика Мугалими", email: "teacher@bilimal.org" },
        tests: [
            { id: "test_1", title: "Ом мыйзамы жана Электр чынжырлары", status: "active", createdAt: 1717181000000, questions: [] },
            { id: "test_2", title: "Механикалык энергиянын сакталуу мыйзамы", status: "draft", createdAt: 1717282000000, questions: [] }
        ],
        classes: [{ id: "c_1", name: "9-А" }, { id: "c_2", name: "10-Б" }],
        students: [{ id: "s_1", classId: "c_1", name: "Асан Бакиров" }],
        logs: []
    };

    let currentPage = 1;
    const itemsPerPage = 5;
    let activeTestIdForModal = null;
    let confirmCallback = null;

    // --- ЖАЛПЫ БАСКЫЧТАРДЫ ТЕКШЕРҮҮ ЖАНА АТКАРУУ ФУНКЦИЯЛАРЫ ---
    
    // Тексттик билдирүүлөр (Toast)
    function showToast(message, type = "success") {
        const container = document.getElementById("toast-container");
        if (!container) return;
        
        const toast = document.createElement("div");
        const uniqueId = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        toast.id = uniqueId;
        toast.className = `toast toast-${type}`;
        
        toast.innerHTML = `
            <span>${message}</span>
            <button id="btn-close-${uniqueId}" class="toast-close-btn">&times;</button>
        `;
        container.appendChild(toast);

        // Toast жабуу баскычынын иштеши
        const closeBtn = document.getElementById(`btn-close-${uniqueId}`);
        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                try { toast.remove(); } catch(e) { console.error(e); }
            });
        }
        setTimeout(() => { try { toast.remove(); } catch(e) {} }, 4000);
    }

    // Баскычты коопсуз башкаруу (Loading & Anti-Double Click)
    async function safeExecuteButton(buttonId, actionFunction) {
        const btn = document.getElementById(buttonId);
        if (!btn) return; // DOM элемент жок болсо код бузулбайт

        const originalHTML = btn.innerHTML;
        try {
            btn.disabled = true;
            btn.setAttribute("data-loading", "true");
            btn.innerHTML = `<span class="spinner">Күтө туруңуз...</span>`;
            
            await actionFunction(btn);
            
        } catch (error) {
            console.error(`Каталык чыкты [ID: ${buttonId}]:`, error);
            showToast(`Амал аткарылган жок: ${error.message}`, "error");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.removeAttribute("data-loading");
                btn.innerHTML = originalHTML;
            }
        }
    }

    // Модалдарды Башкаруу
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove("hidden");
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add("hidden");
    }

    function openConfirmModal(title, message, onConfirm) {
        const titleEl = document.getElementById("confirm-modal-title");
        const msgEl = document.getElementById("confirm-modal-message");
        if (titleEl) titleEl.innerText = title;
        if (msgEl) msgEl.innerText = message;
        confirmCallback = onConfirm;
        openModal("modal-universal-confirm");
    }

    // --- ИНТЕРФЕЙС ЖАНА МЕНЮ БАСКЫЧТАРЫ (EVENT LISTENERS) ---
    
    const bindInterfaceEvents = () => {
        const interfaceBindings = {
            "btn-mobile-menu-toggle": () => {
                const sidebar = document.getElementById("sidebar-menu");
                if (sidebar) sidebar.classList.toggle("mobile-open");
                showToast("Мобилдик меню алмаштырылды", "success");
            },
            "btn-theme-toggle": () => {
                const body = document.getElementById("app-body");
                if (body) {
                    body.classList.toggle("dark-theme");
                    body.classList.toggle("light-theme");
                    showToast("Интерфейс темасы өзгөрдү", "success");
                }
            },
            "btn-notification-bell": () => {
                const count = document.getElementById("noti-count");
                if (count) count.innerText = "0";
                showToast("Бардык билдирүүлөр окулду", "success");
            },
            "btn-global-search": () => {
                const term = document.getElementById("input-global-search")?.value || "";
                showToast(`Издөө жүргүзүлдү: ${term}`, "success");
            },
            "nav-btn-profile": () => showToast("Мугалим профили жүктөлдү", "success"),
            "nav-btn-tests": () => showToast("Тесттер барагы активдүү", "success"),
            "nav-btn-questions": () => showToast("Суроолор бөлүмү ачылды", "success"),
            "nav-btn-classes": () => showToast("Класстар жана окуучулар бөлүмү", "success"),
            "nav-btn-analytics": () => showToast("Аналитика панели жүктөлдү", "success"),
            "nav-btn-admin": () => showToast("Администратордук укуктар текшерилди", "success"),
            "nav-btn-logout": () => openConfirmModal("Системадан чыгуу", "Чын эле чыгууну каалайсызбы?", () => {
                showToast("Системадан ийгиликтүү чыктыңыз", "success");
            }),
            "btn-modal-cancel": () => closeModal("modal-test-editor"),
            "btn-modal-confirm-no": () => closeModal("modal-universal-confirm"),
            "btn-modal-confirm-yes": async () => {
                if (confirmCallback) {
                    await safeExecuteButton("btn-modal-confirm-yes", async () => {
                        await confirmCallback();
                        closeModal("modal-universal-confirm");
                    });
                }
            },
            "btn-clear-test-filters": () => {
                const fStatus = document.getElementById("select-test-filter-status");
                const fSort = document.getElementById("select-test-sort");
                if (fStatus) fStatus.value = "all";
                if (fSort) fSort.value = "date-desc";
                showToast("Бардык фильтрлер тазаланды", "success");
                renderTests();
            },
            "btn-pagination-prev": () => {
                if (currentPage > 1) { currentPage--; renderTests(); showToast(`Барак ${currentPage}`, "success"); }
            },
            "btn-pagination-next": () => {
                currentPage++; renderTests(); showToast(`Барак ${currentPage}`, "success");
            }
        };

        Object.keys(interfaceBindings).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener("click", () => {
                try { interfaceBindings[id](); } catch(e) { console.error(e); }
            });
        });
    };

    // --- ТЕСТ БАШКАРУУ ОПЕРАЦИЯЛАРЫ (FIREBASE / API СИМУЛЯЦИЯ) ---
    
    const bindTestManagementEvents = () => {
        // Жаңы тест түзүү
        const btnCreate = document.getElementById("btn-create-new-test");
        if (btnCreate) {
            btnCreate.addEventListener("click", () => {
                safeExecuteButton("btn-create-new-test", async () => {
                    activeTestIdForModal = null;
                    document.getElementById("input-test-id").value = "";
                    document.getElementById("input-test-title").value = "";
                    document.getElementById("modal-questions-list").innerHTML = "";
                    document.getElementById("modal-title").innerText = "Жаңы Тест Түзүү";
                    openModal("modal-test-editor");
                });
            });
        }

        // Черновик сактоо
        const btnDraft = document.getElementById("btn-save-draft");
        if (btnDraft) {
            btnDraft.addEventListener("click", () => {
                safeExecuteButton("btn-save-draft", async () => {
                    const title = document.getElementById("input-test-title").value;
                    if (!title) throw new Error("Тесттин аталышы бош болбошу керек!");
                    
                    await new Promise(resolve => setTimeout(resolve, 800)); // Firebase убактысы
                    DB.tests.push({ id: `test_${Date.now()}`, title, status: "draft", questions: [] });
                    showToast("Тест ийгиликтүү черновикке сакталды!", "success");
                    closeModal("modal-test-editor");
                    renderTests();
                });
            });
        }

        // Тестти Жарыялоо
        const btnPublish = document.getElementById("btn-publish-test");
        if (btnPublish) {
            btnPublish.addEventListener("click", () => {
                safeExecuteButton("btn-publish-test", async () => {
                    const title = document.getElementById("input-test-title").value;
                    if (!title) throw new Error("Тесттин аталышы маанилүү!");

                    await new Promise(resolve => setTimeout(resolve, 1000));
                    DB.tests.push({ id: `test_${Date.now()}`, title, status: "active", questions: [] });
                    showToast("Тест ийгиликтүү жарыяланды! Окуучулар көрө алышат.", "success");
                    closeModal("modal-test-editor");
                    renderTests();
                });
            });
        }

        // Алдын ала көрүү
        const btnPreview = document.getElementById("btn-preview-test");
        if (btnPreview) {
            btnPreview.addEventListener("click", () => {
                safeExecuteButton("btn-preview-test", async () => {
                    const title = document.getElementById("input-test-title").value || "Аталышсыз тест";
                    showToast(`Алдын ала көрүү режими: ${title}`, "success");
                });
            });
        }

        // JSON Импорт
        const btnImport = document.getElementById("btn-json-import");
        if (btnImport) {
            btnImport.addEventListener("click", () => {
                safeExecuteButton("btn-json-import", async () => {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    showToast("JSON файл ийгиликтүү импорттолду", "success");
                });
            });
        }
    };

    // --- ДИНАМИКАЛЫК ТЕСТ КАРТАЛАРЫН ЖАНА АЛАРДЫН БАСКЫЧТАРЫН ЧЫГАРУУ ---
    function renderTests() {
        const container = document.getElementById("tests-list-container");
        if (!container) return;
        container.innerHTML = "";

        DB.tests.forEach((test, index) => {
            const card = document.createElement("div");
            card.className = `test-card ${test.status}`;
            card.innerHTML = `
                <h4>${test.title}</h4>
                <p>Абалы: <strong>${test.status}</strong></p>
                <div class="card-actions">
                    <button id="btn-edit-${test.id}" class="action-btn">Түзөтүү</button>
                    <button id="btn-copy-${test.id}" class="action-btn">Көчүрүү</button>
                    <button id="btn-archive-${test.id}" class="action-btn">${test.status === 'archived' ? 'Активдештирүү' : 'Архивдөө'}</button>
                    <button id="btn-delete-${test.id}" class="danger-btn">Өчүрүү</button>
                    <button id="btn-link-${test.id}" class="action-btn">Шилтеме</button>
                    <button id="btn-qr-${test.id}" class="action-btn">QR код</button>
                    <button id="btn-wa-${test.id}" class="action-btn">WhatsApp</button>
                    <button id="btn-tg-${test.id}" class="action-btn">Telegram</button>
                    <button id="btn-results-${test.id}" class="action-btn">Жыйынтыктар</button>
                    <button id="btn-excel-${test.id}" class="action-btn">Excel</button>
                    <button id="btn-csv-${test.id}" class="action-btn">CSV</button>
                    <button id="btn-json-exp-${test.id}" class="action-btn">JSON Экспорт</button>
                    <button id="btn-print-${test.id}" class="action-btn">Басып чыгаруу</button>
                </div>
            `;
            container.appendChild(card);

            // Ар бир динамикалык баскыч үчүн Event Listener байлоо жана коопсуз иштетүү
            const dynamicButtons = [
                { suffix: `edit-${test.id}`, phrase: "Түзөтүү режими ачылды", action: () => {
                    document.getElementById("input-test-id").value = test.id;
                    document.getElementById("input-test-title").value = test.title;
                    openModal("modal-test-editor");
                }},
                { suffix: `copy-${test.id}`, phrase: "Тест ийгиликтүү көчүрүлдү", action: () => {
                    DB.tests.push({ ...test, id: `test_${Date.now()}`, title: `${test.title} (Көчүрмө)` });
                    renderTests();
                }},
                { suffix: `archive-${test.id}`, phrase: "Тесттин статусу өзгөртүлдү", action: () => {
                    test.status = test.status === "archived" ? "active" : "archived";
                    renderTests();
                }},
                { suffix: `delete-${test.id}`, phrase: "Тест толугу менен өчүрүлдү", action: () => {
                    openConfirmModal("Тестти өчүрүү", "Бул амалды артка кайтаруу мүмкүн эмес. Өчүрөсүзбү?", () => {
                        DB.tests.splice(index, 1);
                        renderTests();
                    });
                }},
                { suffix: `link-${test.id}`, phrase: "Тест шилтемеси алмашуу буферине көчүрүлдү", action: () => {} },
                { suffix: `qr-${test.id}`, phrase: "Тест үчүн QR код ийгиликтүү түзүлдү", action: () => {} },
                { suffix: `wa-${test.id}`, phrase: "WhatsApp аркылуу бөлүшүү шилтемеси даяр", action: () => {} },
                { suffix: `tg-${test.id}`, phrase: "Telegram аркылуу бөлүшүү шилтемеси даяр", action: () => {} },
                { suffix: `results-${test.id}`, phrase: "Тесттин жыйынтыктары жана аналитикасы жүктөлдү", action: () => {} },
                { suffix: `excel-${test.id}`, phrase: "Excel отчету жүктөлүп алынууда...", action: () => {} },
                { suffix: `csv-${test.id}`, phrase: "CSV файл компьютериңизге сакталды", action: () => {} },
                { suffix: `json-exp-${test.id}`, phrase: "Тест структурасы JSON форматында жүктөлдү", action: () => {} },
                { suffix: `print-${test.id}`, phrase: "Басып чыгаруу терезеси даярдалды", action: () => {} }
            ];

            dynamicButtons.forEach(btnConf => {
                const bId = `btn-${btnConf.suffix}`;
                const element = document.getElementById(bId);
                if (element) {
                    element.addEventListener("click", () => {
                        safeExecuteButton(bId, async () => {
                            await new Promise(r => setTimeout(r, 600)); // Иштөө симуляциясы
                            btnConf.action();
                            showToast(btnConf.phrase, "success");
                        });
                    });
                }
            });
        });

        const spanPage = document.getElementById("span-pagination-info");
        if (spanPage) spanPage.innerText = `Барак ${currentPage} / 1`;
    }

    // --- МОДАЛ ИЧИНДЕГИ СУРООЛОРДУ БАШКАРУУ БАСКЫЧТАРЫ ---
    const bindInnerQuestionEvents = () => {
        const btnAddQ = document.getElementById("btn-add-question");
        if (btnAddQ) {
            btnAddQ.addEventListener("click", () => {
                safeExecuteButton("btn-add-question", async () => {
                    const qContainer = document.getElementById("modal-questions-list");
                    const qId = `q_${Date.now()}`;
                    const qDiv = document.createElement("div");
                    qDiv.className = "question-item-block";
                    qDiv.id = `block-${qId}`;
                    qDiv.innerHTML = `
                        <div class="q-header">
                            <input type="text" placeholder="Суроонун тексти" class="q-input-text">
                            <button id="btn-q-up-${qId}" class="mini-btn">▲</button>
                            <button id="btn-q-down-${qId}" class="mini-btn">▼</button>
                            <button id="btn-q-copy-${qId}" class="mini-btn">📄 Көчүрүү</button>
                            <button id="btn-q-del-${qId}" class="danger-mini-btn">&times; Өчүрүү</button>
                        </div>
                        <div class="q-media-actions">
                            <button id="btn-q-img-${qId}" class="mini-btn">🖼️ Сүрөт</button>
                            <button id="btn-q-vid-${qId}" class="mini-btn">🎥 Видео URL</button>
                            <button id="btn-q-aud-${qId}" class="mini-btn">🎵 Аудио URL</button>
                        </div>
                        <div id="options-container-${qId}" class="options-box"></div>
                        <button id="btn-opt-add-${qId}" class="secondary-mini-btn">+ Вариант кошуу</button>
                    `;
                    qContainer.appendChild(qDiv);
                    showToast("Жаңы суроо кошулду", "success");
                    bindSingleQuestionControls(qId);
                });
            });
        }

        const btnShuffle = document.getElementById("btn-shuffle-questions");
        if (btnShuffle) {
            btnShuffle.addEventListener("click", () => {
                safeExecuteButton("btn-shuffle-questions", async () => {
                    showToast("Суроолордун тартиби аралаштырылды", "success");
                });
            });
        }
    };

    function bindSingleQuestionControls(qId) {
        // Суроону өчүрүү
        document.getElementById(`btn-q-del-${qId}`)?.addEventListener("click", () => {
            safeExecuteButton(`btn-q-del-${qId}`, async () => {
                document.getElementById(`block-${qId}`)?.remove();
                showToast("Суроо өчүрүлдү", "success");
            });
        });

        // Өйдө/ылдый жылдыруу
        [`btn-q-up-${qId}`, `btn-q-down-${qId}`].forEach(id => {
            document.getElementById(id)?.addEventListener("click", () => {
                safeExecuteButton(id, async () => { showToast("Суроонун орду алмаштырылды", "success"); });
            });
        });

        // Суроону көчүрүү
        document.getElementById(`btn-q-copy-${qId}`)?.addEventListener("click", () => {
            safeExecuteButton(`btn-q-copy-${qId}`, async () => { showToast("Суроо ийгиликтүү ички көчүрүлдү", "success"); });
        });

        // Медиа кошуу баскычтары
        [`btn-q-img-${qId}`, `btn-q-vid-${qId}`, `btn-q-aud-${qId}`].forEach(id => {
            document.getElementById(id)?.addEventListener("click", () => {
                safeExecuteButton(id, async () => { showToast("Медиа шилтеме кошулду", "success"); });
            });
        });

        // Вариант кошуу
        document.getElementById(`btn-opt-add-${qId}`)?.addEventListener("click", () => {
            safeExecuteButton(`btn-opt-add-${qId}`, async () => {
                const optBox = document.getElementById(`options-container-${qId}`);
                const optId = `opt_${Date.now()}`;
                const optDiv = document.createElement("div");
                optDiv.className = "option-row";
                optDiv.id = `row-${optId}`;
                optDiv.innerHTML = `
                    <input type="radio" name="correct-${qId}" id="radio-${optId}">
                    <input type="text" placeholder="Вариант тексти" class="opt-input">
                    <button id="btn-opt-del-${optId}" class="danger-mini-btn">❌</button>
                `;
                optBox.appendChild(optDiv);
                showToast("Вариант кошулду", "success");

                // Вариант өчүрүү
                document.getElementById(`btn-opt-del-${optId}`)?.addEventListener("click", () => {
                    document.getElementById(`row-${optId}`)?.remove();
                    showToast("Вариант өчүрүлдү", "success");
                });

                // Туура жоопту белгилөө
                document.getElementById(`radio-${optId}`)?.addEventListener("change", () => {
                    showToast("Туура жооп белгиленди", "success");
                });
            });
        });
    }

    // Инициализация
    function init() {
        bindInterfaceEvents();
        bindTestManagementEvents();
        bindInnerQuestionEvents();
        renderTests();
        showToast("BilimAl системасы ийгиликтүү жүктөлдү!", "success");
    }

    init();
});
