const nodemailer = require("nodemailer");

function createTransporter(config) {
  const smtp = config?.smtp || {};
  if (!smtp.host || !smtp.user || !smtp.pass) {
    throw new Error("SMTP is not configured. Please update settings.");
  }

  return nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port || 587),
    secure: Boolean(smtp.secure),
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });
}

function shouldNotify(job, log, config) {
  if (!config?.notifications?.enabled || !config?.notifications?.email) return false;
  const preference = job?.notify || "failure";
  if (preference === "none") return false;
  if (preference === "always") return true;
  if (preference === "success" && log.status === "success") return true;
  if (preference === "failure" && log.status === "failed") return true;
  return false;
}

async function sendJobNotification(job, log, config) {
  if (!shouldNotify(job, log, config)) return { skipped: true };
  const transporter = createTransporter(config);
  const statusColor = log.status === "success" ? "#16a34a" : "#dc2626";
  const subject = `[Oggo] Job ${job.name} ${log.status}`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.4">
      <h2 style="margin:0 0 8px">Oggo Job Notification</h2>
      <p><strong>Job:</strong> ${job.name}</p>
      <p><strong>Command:</strong> <code>${job.command}</code></p>
      <p><strong>Schedule:</strong> <code>${job.schedule}</code></p>
      <p><strong>Status:</strong> <span style="color:${statusColor};font-weight:bold">${log.status}</span></p>
      <p><strong>Start Time:</strong> ${log.created_at}</p>
      <p><strong>Duration:</strong> ${log.duration}ms</p>
      <h3 style="margin-bottom:6px">${log.status === "success" ? "Output" : "Error"}</h3>
      <pre style="background:#111827;color:#f9fafb;padding:12px;border-radius:8px;overflow:auto;">${
        log.status === "success" ? log.output || "(empty output)" : log.error || "(no error message)"
      }</pre>
      <p><a href="http://localhost:${config.port}">Open Oggo Dashboard</a></p>
    </div>
  `;

  await transporter.sendMail({
    from: config.smtp.user,
    to: config.notifications.email,
    subject,
    html,
  });

  return { sent: true };
}

async function sendTestEmail(config) {
  const transporter = createTransporter(config);
  await transporter.sendMail({
    from: config.smtp.user,
    to: config.notifications.email,
    subject: "[Oggo] Test email",
    text: "Oggo SMTP test succeeded.",
  });
  return { sent: true, message: "Test email sent successfully." };
}

module.exports = {
  createTransporter,
  sendJobNotification,
  sendTestEmail,
};
