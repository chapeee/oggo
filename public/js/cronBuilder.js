class CronBuilder {
  constructor(containerId, initialExpression = "0 * * * *") {
    this.container = document.getElementById(containerId);
    this.expression = initialExpression;
    this.activeTab = "minutes";
    this.state = {
      minutes: { preset: "*/5 * * * *" },
      hourly: { preset: "0 * * * *", minute: 0 },
      daily: { preset: "every", time: "00:00" },
      weekly: { days: [1], time: "00:00" },
      monthly: { preset: "day", day: 1, time: "00:00", months: [1] },
      yearly: { preset: "jan1", month: 1, day: 1, time: "00:00" },
      custom: { min: "0", hour: "*", day: "*", month: "*", week: "*" },
    };
    this.render();
    this.parseInitial(initialExpression);
  }

  parseInitial(expr) {
    this.expression = expr;
    const parts = expr.split(" ");
    if (parts.length === 5) {
      this.state.custom = { min: parts[0], hour: parts[1], day: parts[2], month: parts[3], week: parts[4] };
    }
    this.activeTab = "custom";
    this.updateUI();
  }

  setExpression(expr) {
    this.expression = expr;
    this.updateUI();
    document.dispatchEvent(
      new CustomEvent("schedulechange", {
        detail: { expression: this.expression, human: window.humanizeCron(this.expression) },
      })
    );
  }

  updateFromTab() {
    let expr = "0 * * * *";
    const s = this.state[this.activeTab];
    if (this.activeTab === "minutes") expr = s.preset;
    if (this.activeTab === "hourly") {
      const [min, hour, d, m, w] = s.preset.split(" ");
      expr = `${s.minute} ${hour} ${d} ${m} ${w}`;
    }
    if (this.activeTab === "daily") {
      const [h, m] = s.time.split(":");
      if (s.preset === "every") expr = `${parseInt(m)} ${parseInt(h)} * * *`;
      if (s.preset === "weekday") expr = `${parseInt(m)} ${parseInt(h)} * * 1-5`;
      if (s.preset === "weekend") expr = `${parseInt(m)} ${parseInt(h)} * * 0,6`;
      if (s.preset === "2days") expr = `${parseInt(m)} ${parseInt(h)} */2 * *`;
      if (s.preset === "3days") expr = `${parseInt(m)} ${parseInt(h)} */3 * *`;
    }
    if (this.activeTab === "weekly") {
      const [h, m] = s.time.split(":");
      const days = s.days.length ? s.days.sort().join(",") : "*";
      expr = `${parseInt(m)} ${parseInt(h)} * * ${days}`;
    }
    if (this.activeTab === "monthly") {
      const [h, m] = s.time.split(":");
      if (s.preset === "day") expr = `${parseInt(m)} ${parseInt(h)} ${s.day} * *`;
      if (s.preset === "months") {
        const months = s.months.length ? s.months.sort((a, b) => a - b).join(",") : "*";
        expr = `${parseInt(m)} ${parseInt(h)} ${s.day} ${months} *`;
      }
      if (s.preset === "first") expr = `0 0 1 * *`;
      if (s.preset === "last") expr = `0 0 28-31 * *`;
      if (s.preset === "1_15") expr = `0 0 1,15 * *`;
      if (s.preset === "quarter") expr = `0 0 1 1,4,7,10 *`;
    }
    if (this.activeTab === "yearly") {
      const [h, m] = s.time.split(":");
      if (s.preset === "jan1") expr = `0 0 1 1 *`;
      if (s.preset === "dec31") expr = `0 0 31 12 *`;
      if (s.preset === "custom") expr = `${parseInt(m)} ${parseInt(h)} ${s.day} ${s.month} *`;
    }
    if (this.activeTab === "custom") {
      expr = `${s.min} ${s.hour} ${s.day} ${s.month} ${s.week}`;
    }
    this.setExpression(expr);
  }

  getNextRuns() {
    try {
      if (!window.cronParser || !window.cronParser.parseExpression) return [];
      const schedule = window.cronParser.parseExpression(this.expression);
      const dates = [];
      const interval = schedule;
      for (let i = 0; i < 3; i++) {
        dates.push(interval.next().toDate());
      }
      return dates;
    } catch (e) {
      return [];
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="bg-white dark:bg-[#1b1410] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
        <div class="flex overflow-x-auto border-b border-gray-200 dark:border-gray-800 hide-scrollbar bg-gray-50 dark:bg-[#161b22]">
          ${["minutes", "hourly", "daily", "weekly", "monthly", "yearly", "custom"]
            .map(
              (t) => `
            <button type="button" data-tab="${t}" class="cron-tab-btn px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                this.activeTab === t
                  ? "border-orange-500 text-orange-500 bg-white dark:bg-[#1b1410]"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }">${t.charAt(0).toUpperCase() + t.slice(1)}</button>
          `
            )
            .join("")}
        </div>
        <div class="p-5 flex-1" id="cron-tab-content"></div>
        <div class="p-5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#161b22]">
          <div class="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-4">
            <div class="flex-1 w-full">
              <label class="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold tracking-wider mb-1 block">Generated Cron Expression</label>
              <div class="flex">
                <input type="text" readonly value="${this.expression}" class="font-mono text-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 w-full text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500">
                <button type="button" id="cron-copy-btn" class="ml-2 p-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors" title="Copy to clipboard">
                  <i data-lucide="copy" class="w-5 h-5"></i>
                </button>
              </div>
            </div>
          </div>
          <div class="text-sm font-medium text-orange-500 mb-4 flex items-center gap-2">
            <i data-lucide="info" class="w-4 h-4"></i>
            <span id="cron-human-text">${window.humanizeCron(this.expression)}</span>
          </div>
          <div>
            <label class="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold tracking-wider mb-2 block">Next 3 Runs</label>
            <ul id="cron-next-runs" class="space-y-1 text-sm text-gray-600 dark:text-gray-300 font-mono text-xs"></ul>
          </div>
        </div>
      </div>
    `;

    this.container.querySelectorAll(".cron-tab-btn").forEach((btn) => {
      btn.onclick = () => {
        this.activeTab = btn.dataset.tab;
        this.updateFromTab();
        this.render();
      };
    });

    const copyBtn = this.container.querySelector("#cron-copy-btn");
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(this.expression);
        window.toast("Copied to clipboard", "success");
      };
    }

    this.renderTabContent();
    this.updatePreview();
    if (window.lucide) window.lucide.createIcons();
  }

  renderTabContent() {
    const content = this.container.querySelector("#cron-tab-content");
    const s = this.state[this.activeTab];

    const radio = (name, value, label, checked) => `
      <label class="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${checked ? 'ring-2 ring-orange-500 border-transparent bg-orange-500/10 dark:bg-orange-500/10' : ''}">
        <input type="radio" name="${name}" value="${value}" class="text-orange-500 focus:ring-orange-500" ${checked ? "checked" : ""}>
        <span class="text-sm font-medium text-gray-700 dark:text-gray-200">${label}</span>
      </label>
    `;

    if (this.activeTab === "minutes") {
      const opts = [
        ["* * * * *", "Every 1 minute"],
        ["*/2 * * * *", "Every 2 minutes"],
        ["*/3 * * * *", "Every 3 minutes"],
        ["*/5 * * * *", "Every 5 minutes"],
        ["*/10 * * * *", "Every 10 minutes"],
        ["*/15 * * * *", "Every 15 minutes"],
        ["*/20 * * * *", "Every 20 minutes"],
        ["*/30 * * * *", "Every 30 minutes"],
      ];
      content.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        ${opts.map(([val, label]) => radio("min_preset", val, label, s.preset === val)).join("")}
      </div>`;
      content.querySelectorAll('input[type="radio"]').forEach((el) => {
        el.onchange = (e) => {
          s.preset = e.target.value;
          this.updateFromTab();
          this.render();
        };
      });
    } else if (this.activeTab === "hourly") {
      const opts = [
        ["0 * * * *", "Every hour"],
        ["0 */2 * * *", "Every 2 hours"],
        ["0 */3 * * *", "Every 3 hours"],
        ["0 */4 * * *", "Every 4 hours"],
        ["0 */6 * * *", "Every 6 hours"],
        ["0 */8 * * *", "Every 8 hours"],
        ["0 */12 * * *", "Every 12 hours"],
      ];
      content.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          ${opts.map(([val, label]) => radio("hour_preset", val, label, s.preset === val)).join("")}
        </div>
        <div class="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">At minute:</label>
          <input type="number" min="0" max="59" value="${s.minute}" class="input w-24 text-center" id="hour_min">
        </div>
      `;
      content.querySelectorAll('input[type="radio"]').forEach((el) => {
        el.onchange = (e) => {
          s.preset = e.target.value;
          this.updateFromTab();
          this.render();
        };
      });
      content.querySelector("#hour_min").oninput = (e) => {
        s.minute = parseInt(e.target.value) || 0;
        this.updateFromTab();
      };
    } else if (this.activeTab === "daily") {
      const opts = [
        ["every", "Every day"],
        ["weekday", "Every weekday (Mon-Fri)"],
        ["weekend", "Every weekend (Sat-Sun)"],
        ["2days", "Every 2 days"],
        ["3days", "Every 3 days"],
      ];
      content.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          ${opts.map(([val, label]) => radio("day_preset", val, label, s.preset === val)).join("")}
        </div>
        <div class="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">At time:</label>
          <input type="time" value="${s.time}" class="input w-32" id="day_time">
        </div>
      `;
      content.querySelectorAll('input[type="radio"]').forEach((el) => {
        el.onchange = (e) => {
          s.preset = e.target.value;
          this.updateFromTab();
          this.render();
        };
      });
      content.querySelector("#day_time").oninput = (e) => {
        s.time = e.target.value || "00:00";
        this.updateFromTab();
      };
    } else if (this.activeTab === "weekly") {
      const days = [
        { val: 0, label: "Sun" },
        { val: 1, label: "Mon" },
        { val: 2, label: "Tue" },
        { val: 3, label: "Wed" },
        { val: 4, label: "Thu" },
        { val: 5, label: "Fri" },
        { val: 6, label: "Sat" },
      ];
      content.innerHTML = `
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Select Days:</label>
          <div class="flex flex-wrap gap-2">
            ${days
              .map(
                (d) => `
              <button type="button" data-day="${d.val}" class="week-day-btn px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  s.days.includes(d.val)
                    ? "bg-orange-500 text-white shadow-sm ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-gray-800"
                    : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                }">${d.label}</button>
            `
              )
              .join("")}
          </div>
        </div>
        <div class="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 w-full sm:w-auto">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">At time:</label>
          <input type="time" value="${s.time}" class="input w-32" id="week_time">
        </div>
      `;
      content.querySelectorAll(".week-day-btn").forEach((btn) => {
        btn.onclick = () => {
          const val = parseInt(btn.dataset.day);
          if (s.days.includes(val)) s.days = s.days.filter((d) => d !== val);
          else s.days.push(val);
          this.updateFromTab();
          this.render();
        };
      });
      content.querySelector("#week_time").oninput = (e) => {
        s.time = e.target.value || "00:00";
        this.updateFromTab();
      };
    } else if (this.activeTab === "monthly") {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      content.innerHTML = `
        <div class="space-y-4">
          ${radio("month_preset", "day", "Specific Day of Month", s.preset === "day")}
          <div class="pl-8 ${s.preset !== "day" ? "opacity-50 pointer-events-none" : ""}">
            <div class="flex items-center gap-3">
              <label class="text-sm text-gray-600 dark:text-gray-400">On day:</label>
              <input type="number" min="1" max="31" value="${s.day}" class="input w-20 text-center" id="month_day">
            </div>
          </div>

          ${radio("month_preset", "months", "Specific Months", s.preset === "months")}
          <div class="pl-8 ${s.preset !== "months" ? "opacity-50 pointer-events-none" : ""}">
            <div class="flex flex-wrap gap-2 mt-2">
              ${months
                .map(
                  (m, i) => `
                <button type="button" data-month="${i + 1}" class="month-btn px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    s.months.includes(i + 1)
                      ? "bg-orange-500 text-white"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600"
                  }">${m}</button>
              `
                )
                .join("")}
            </div>
          </div>

          <div class="pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${radio("month_preset", "first", "First day of month", s.preset === "first")}
            ${radio("month_preset", "last", "Last day of month", s.preset === "last")}
            ${radio("month_preset", "1_15", "1st and 15th of month", s.preset === "1_15")}
            ${radio("month_preset", "quarter", "Every quarter", s.preset === "quarter")}
          </div>

          <div class="mt-6 flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">At time:</label>
            <input type="time" value="${s.time}" class="input w-32" id="month_time">
          </div>
        </div>
      `;
      content.querySelectorAll('input[type="radio"]').forEach((el) => {
        el.onchange = (e) => {
          s.preset = e.target.value;
          this.updateFromTab();
          this.render();
        };
      });
      content.querySelector("#month_day").oninput = (e) => {
        s.day = parseInt(e.target.value) || 1;
        this.updateFromTab();
      };
      content.querySelector("#month_time").oninput = (e) => {
        s.time = e.target.value || "00:00";
        this.updateFromTab();
      };
      content.querySelectorAll(".month-btn").forEach((btn) => {
        btn.onclick = () => {
          const val = parseInt(btn.dataset.month);
          if (s.months.includes(val)) s.months = s.months.filter((m) => m !== val);
          else s.months.push(val);
          this.updateFromTab();
          this.render();
        };
      });
    } else if (this.activeTab === "yearly") {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      content.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          ${radio("year_preset", "jan1", "New Year (Jan 1)", s.preset === "jan1")}
          ${radio("year_preset", "dec31", "New Year's Eve (Dec 31)", s.preset === "dec31")}
          ${radio("year_preset", "custom", "Custom Date", s.preset === "custom")}
        </div>
        <div class="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 ${
          s.preset !== "custom" ? "opacity-50 pointer-events-none" : ""
        }">
          <div class="flex items-center gap-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Month:</label>
            <select id="year_month" class="input w-28">
              ${months.map((m, i) => `<option value="${i + 1}" ${s.month === i + 1 ? "selected" : ""}>${m}</option>`).join("")}
            </select>
          </div>
          <div class="flex items-center gap-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Day:</label>
            <input type="number" min="1" max="31" value="${s.day}" class="input w-20 text-center" id="year_day">
          </div>
          <div class="flex items-center gap-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Time:</label>
            <input type="time" value="${s.time}" class="input w-32" id="year_time">
          </div>
        </div>
      `;
      content.querySelectorAll('input[type="radio"]').forEach((el) => {
        el.onchange = (e) => {
          s.preset = e.target.value;
          this.updateFromTab();
          this.render();
        };
      });
      content.querySelector("#year_month").onchange = (e) => {
        s.month = parseInt(e.target.value) || 1;
        this.updateFromTab();
      };
      content.querySelector("#year_day").oninput = (e) => {
        s.day = parseInt(e.target.value) || 1;
        this.updateFromTab();
      };
      content.querySelector("#year_time").oninput = (e) => {
        s.time = e.target.value || "00:00";
        this.updateFromTab();
      };
    } else if (this.activeTab === "custom") {
      content.innerHTML = `
        <div class="grid grid-cols-5 gap-2 mb-8">
          <div>
            <input type="text" id="cust_min" value="${s.min}" class="input font-mono text-center mb-1">
            <div class="text-[10px] text-center text-gray-500 font-semibold uppercase tracking-wider">Minute</div>
            <div class="text-[10px] text-center text-gray-400 mt-1">0-59</div>
          </div>
          <div>
            <input type="text" id="cust_hour" value="${s.hour}" class="input font-mono text-center mb-1">
            <div class="text-[10px] text-center text-gray-500 font-semibold uppercase tracking-wider">Hour</div>
            <div class="text-[10px] text-center text-gray-400 mt-1">0-23</div>
          </div>
          <div>
            <input type="text" id="cust_day" value="${s.day}" class="input font-mono text-center mb-1">
            <div class="text-[10px] text-center text-gray-500 font-semibold uppercase tracking-wider">Day</div>
            <div class="text-[10px] text-center text-gray-400 mt-1">1-31</div>
          </div>
          <div>
            <input type="text" id="cust_month" value="${s.month}" class="input font-mono text-center mb-1">
            <div class="text-[10px] text-center text-gray-500 font-semibold uppercase tracking-wider">Month</div>
            <div class="text-[10px] text-center text-gray-400 mt-1">1-12</div>
          </div>
          <div>
            <input type="text" id="cust_week" value="${s.week}" class="input font-mono text-center mb-1">
            <div class="text-[10px] text-center text-gray-500 font-semibold uppercase tracking-wider">Weekday</div>
            <div class="text-[10px] text-center text-gray-400 mt-1">0-6</div>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Shortcuts:</label>
          <div class="flex flex-wrap gap-2">
            ${["@reboot", "@hourly", "@daily", "@weekly", "@monthly", "@yearly"]
              .map(
                (v) =>
                  `<button type="button" class="cust-shortcut px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded text-xs font-mono transition-colors" data-val="${v}">${v}</button>`
              )
              .join("")}
          </div>
        </div>
      `;
      ["min", "hour", "day", "month", "week"].forEach((k) => {
        content.querySelector(`#cust_${k}`).oninput = (e) => {
          s[k] = e.target.value || "*";
          this.updateFromTab();
        };
      });
      content.querySelectorAll(".cust-shortcut").forEach((btn) => {
        btn.onclick = () => {
          this.expression = btn.dataset.val;
          this.updateUI();
          document.dispatchEvent(
            new CustomEvent("schedulechange", {
              detail: { expression: this.expression, human: window.humanizeCron(this.expression) },
            })
          );
        };
      });
    }
  }

  updateUI() {
    const preview = this.container.querySelector("#cron-human-text");
    if (preview) preview.textContent = window.humanizeCron(this.expression);
    
    const input = this.container.querySelector("input[readonly]");
    if (input) input.value = this.expression;

    this.updatePreview();
  }

  updatePreview() {
    const runsList = this.container.querySelector("#cron-next-runs");
    if (runsList) {
      const runs = this.getNextRuns();
      if (runs.length) {
        runsList.innerHTML = runs
          .map(
            (d) =>
              `<li>${d.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })} ${d.toLocaleTimeString()}</li>`
          )
          .join("");
      } else {
        runsList.innerHTML = `<li class="text-red-500">Invalid cron expression</li>`;
      }
    }
  }
}
window.CronBuilder = CronBuilder;
