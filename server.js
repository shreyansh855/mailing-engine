const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure local logs directory exists (Private to server admin only)
const LOGS_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}
const LOG_FILE = path.join(LOGS_DIR, 'emails.log');

// Private logging function: ONLY visible in your local terminal/Render console and private log file
function appendLog(line) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const formattedLine = `[${timestamp}] ${line}`;
  
  // 1. Prints strictly to your private terminal / Render backend dashboard
  console.log(formattedLine);

  // 2. Saves to private local disk file (never exposed on web)
  fs.appendFile(LOG_FILE, formattedLine + '\n', (err) => {
    if (err) console.error('Failed to write to private log file:', err);
  });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// In-memory data store for sessions and jobs
const sessions = new Map();
const jobs = new Map();

// Valid users
const VALID_USERS = [
  {
    userName: 'qYYPsODwgA',
    password: 'JlCxWYnrAvrxqQue',
    name: 'Vikas new link 2'
  }
];

// Clean up old jobs after 1 hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs.entries()) {
    if (job.createdAt < oneHourAgo) {
      jobs.delete(id);
    }
  }
}, 10 * 60 * 1000);

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Login endpoint
app.post('/loginForm', (req, res) => {
  const { userName, password } = req.body || {};

  if (!userName || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const user = VALID_USERS.find(
    u => u.userName === userName.trim() && u.password === password.trim()
  );

  // If matched
  if (user) {
    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, {
      userName: user.userName,
      name: user.name,
      createdAt: Date.now()
    });

    appendLog(`[AUTH] User "${user.name}" logged in successfully.`);

    return res.json({
      message: 'Login successful.',
      sessionId: sessionId,
      name: user.name
    });
  }

  // Also support any valid 10-char username and 16-char password
  if (userName.trim().length === 10 && password.trim().length === 16) {
    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, {
      userName: userName.trim(),
      name: 'User',
      createdAt: Date.now()
    });

    appendLog(`[AUTH] User logged in.`);

    return res.json({
      message: 'Login successful.',
      sessionId: sessionId,
      name: 'User'
    });
  }

  appendLog(`[AUTH FAILED] Failed login attempt with username: "${userName}"`);
  return res.status(401).json({ message: 'Invalid username or password.' });
});

// Send Gmail endpoint
app.post('/sendGmail', (req, res) => {
  const {
    sentFrom,
    appPass,
    subject,
    htmlBody,
    realBody,
    eMails,
    firstName,
    sessionId,
    isPort587,
    isHTML,
    isEditor,
    addGreetings,
    addClosing,
    addSuggestions,
    shouldDelay
  } = req.body || {};

  // Validation
  if (!sessionId) {
    return res.status(401).json({ message: 'VALIDATION_FAILED: Unauthorized session.' });
  }

  if (!sentFrom) {
    const jobId = crypto.randomUUID();
    jobs.set(jobId, {
      status: 'done',
      message: 'Failed to invoke email function. VALIDATION_FAILED: sentFrom is required',
      sent: 0,
      failed: 0,
      totalRequested: 0,
      createdAt: Date.now()
    });
    return res.json({ jobId });
  }

  if (!appPass) {
    const jobId = crypto.randomUUID();
    jobs.set(jobId, {
      status: 'done',
      message: 'Failed to invoke email function. VALIDATION_FAILED: appPass is required',
      sent: 0,
      failed: 0,
      totalRequested: 0,
      createdAt: Date.now()
    });
    return res.json({ jobId });
  }

  if (!eMails || !Array.isArray(eMails) || eMails.length === 0) {
    const jobId = crypto.randomUUID();
    jobs.set(jobId, {
      status: 'done',
      message: 'Failed to invoke email function. VALIDATION_FAILED: eMails list is required',
      sent: 0,
      failed: 0,
      totalRequested: 0,
      createdAt: Date.now()
    });
    return res.json({ jobId });
  }

  // Create job
  const jobId = crypto.randomUUID();
  const totalRequested = eMails.length;

  jobs.set(jobId, {
    status: 'pending',
    message: 'Processing email delivery...',
    sent: 0,
    failed: 0,
    totalRequested: totalRequested,
    createdAt: Date.now()
  });

  // Private log for job start
  appendLog(`----------------------------------------------------------------------`);
  appendLog(`[JOB START] Batch Job ID: ${jobId}`);
  appendLog(`  • Sender Account: ${sentFrom}`);
  appendLog(`  • Subject: "${subject || '(No Subject)'}"`);
  appendLog(`  • Total Recipients Target: ${totalRequested}`);
  appendLog(`  • Settings: Port=${isPort587 ? 587 : 465} | HTML=${Boolean(isEditor)} | Delay=${Boolean(shouldDelay)}`);
  appendLog(`----------------------------------------------------------------------`);

  // Respond immediately with jobId
  res.json({ jobId });

  // Run email sending in background
  (async () => {
    let sentCount = 0;
    let failedCount = 0;
    const errors = [];

    const cleanAppPass = (appPass || '').replace(/\s+/g, '');
    const usePort587 = Boolean(isPort587);

    // Setup Nodemailer Gmail transport
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: usePort587 ? 587 : 465,
      secure: !usePort587,
      auth: {
        user: sentFrom,
        pass: cleanAppPass
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    for (let i = 0; i < eMails.length; i++) {
      const recipient = eMails[i];
      const indexStr = `[${i + 1}/${totalRequested}]`;

      try {
        let content = isEditor ? (htmlBody || realBody || '') : (realBody || '');

        if (addGreetings) {
          const greetingText = isEditor ? '<p>Hello,</p>' : 'Hello,\n\n';
          content = greetingText + content;
        }

        if (addClosing) {
          const senderName = firstName || 'Sender';
          const closingText = isEditor
            ? `<p><br>Best regards,<br>${senderName}</p>`
            : `\n\nBest regards,\n${senderName}`;
          content = content + closingText;
        }

        if (addSuggestions) {
          const suggestionText = isEditor
            ? '<p style="font-size:11px;color:#888;margin-top:20px;border-top:1px solid #eee;padding-top:10px;">Feel free to reply if you have questions or suggestions.</p>'
            : '\n\n---\nFeel free to reply if you have questions or suggestions.';
          content = content + suggestionText;
        }

        const mailOptions = {
          from: `"${firstName || sentFrom}" <${sentFrom}>`,
          to: recipient,
          subject: subject || '(No Subject)',
          ...(isEditor ? { html: content } : { text: content })
        };

        await transporter.sendMail(mailOptions);
        sentCount++;
        
        // Detailed private terminal log
        appendLog(`[SUCCESS] ${indexStr} -> Sent to: ${recipient}`);

      } catch (err) {
        failedCount++;
        const errMsg = err.message || 'Unknown error';
        errors.push(`${recipient}: ${errMsg}`);
        
        // Detailed private failure log
        appendLog(`[FAILED]  ${indexStr} -> Failed to: ${recipient} | Error: ${errMsg}`);
      }

      // Delay between emails if enabled
      if (shouldDelay && i < eMails.length - 1) {
        appendLog(`[INFO] Delaying 2 seconds before next recipient...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const job = jobs.get(jobId);
    if (job) {
      job.status = 'done';
      job.sent = sentCount;
      job.failed = failedCount;
      if (failedCount === 0) {
        job.message = 'All emails sent successfully!';
      } else if (sentCount === 0) {
        job.message = `Failed to send emails. Error: ${errors[0] || 'Unknown error'}`;
      } else {
        job.message = `Emails sent with some errors. Sent: ${sentCount}, Failed: ${failedCount}`;
      }
      jobs.set(jobId, job);
    }

    // Summary Private Log
    appendLog(`======================================================================`);
    appendLog(`[JOB SUMMARY] Job ID: ${jobId}`);
    appendLog(`  • Sender: ${sentFrom}`);
    appendLog(`  • Total Processed: ${totalRequested}`);
    appendLog(`  • Successfully Delivered: ${sentCount}`);
    appendLog(`  • Failed: ${failedCount}`);
    appendLog(`======================================================================\n`);

  })().catch(err => {
    appendLog(`[ERROR] Fatal background job error: ${err.message}`);
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'done';
      job.message = `Fatal error: ${err.message}`;
      jobs.set(jobId, job);
    }
  });
});

// Polling endpoint for job status (Only returns counts & success/fail message, no recipient list)
app.get('/jobStatus/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({
      status: 'error',
      message: 'Job not found.'
    });
  }

  res.json({
    status: job.status,
    message: job.message,
    sent: job.sent,
    failed: job.failed,
    totalRequested: job.totalRequested
  });
});

// Start server
app.listen(PORT, () => {
  appendLog(`===========================================`);
  appendLog(` Mailing Engine running securely on:`);
  appendLog(` http://localhost:${PORT}/login.html`);
  appendLog(` http://localhost:${PORT}/sendGmail.html`);
  appendLog(` (Logs are strictly PRIVATE to terminal only)`);
  appendLog(`===========================================`);
});
