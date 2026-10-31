"""Email + SMS delivery for verification codes and SOS alerts.

* Email: any SMTP server (e.g. Gmail with an App Password, Zoho, Brevo, AWS SES).
* SMS:   Twilio (international) or a custom HTTP gateway URL — works with most
         Indian SMS providers (MSG91, Fast2SMS, Textlocal, …). Use the
         placeholders {phone} and {message} (URL-encoded automatically), e.g.
         https://provider.example/send?key=XXXX&to={phone}&text={message}

If nothing is configured, messages are printed in the server window
("developer mode") so the product still works on a local computer.
"""
from __future__ import annotations

import base64
import json
import logging
import smtplib
import ssl
import urllib.error
import urllib.parse
import urllib.request
from email.message import EmailMessage
from typing import Dict, Tuple

log = logging.getLogger("problemhunt.notify")


def email_ready(s: Dict) -> bool:
    return bool(s.get("smtp_host") and s.get("smtp_user") and s.get("smtp_password"))


def sms_ready(s: Dict) -> bool:
    if s.get("sms_provider") == "twilio":
        return bool(s.get("twilio_sid") and s.get("twilio_token") and s.get("twilio_from"))
    if s.get("sms_provider") == "webhook":
        return bool(s.get("sms_webhook_url"))
    return False


def send_email(s: Dict, to: str, subject: str, body: str) -> Tuple[bool, str]:
    if not email_ready(s):
        print(f"\n[ProblemHunt DEV EMAIL] to={to}\n  {subject}\n  {body}\n", flush=True)
        return False, "email not configured (printed in server window)"
    msg = EmailMessage()
    msg["From"] = s.get("smtp_from") or s["smtp_user"]
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    try:
        port = int(s.get("smtp_port") or 587)
        if port == 465:
            with smtplib.SMTP_SSL(s["smtp_host"], port, context=ssl.create_default_context(), timeout=15) as smtp:
                smtp.login(s["smtp_user"], s["smtp_password"])
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(s["smtp_host"], port, timeout=15) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                smtp.login(s["smtp_user"], s["smtp_password"])
                smtp.send_message(msg)
        return True, "sent"
    except Exception as exc:
        log.warning("email send failed: %s", exc)
        return False, f"email failed: {exc.__class__.__name__}"


def send_sms(s: Dict, phone: str, text: str) -> Tuple[bool, str]:
    if not sms_ready(s):
        print(f"\n[ProblemHunt DEV SMS] to={phone}\n  {text}\n", flush=True)
        return False, "SMS not configured (printed in server window)"
    try:
        if s["sms_provider"] == "twilio":
            auth = base64.b64encode(f"{s['twilio_sid']}:{s['twilio_token']}".encode()).decode()
            data = urllib.parse.urlencode({"To": phone, "From": s["twilio_from"], "Body": text}).encode()
            req = urllib.request.Request(
                f"https://api.twilio.com/2010-04-01/Accounts/{urllib.parse.quote(s['twilio_sid'])}/Messages.json",
                data=data, method="POST",
                headers={"Authorization": f"Basic {auth}", "Content-Type": "application/x-www-form-urlencoded"})
        else:
            tpl = s["sms_webhook_url"]
            if not tpl.lower().startswith("https://"):
                return False, "SMS gateway URL must start with https://"
            digits = phone.lstrip("+")
            url = (tpl.replace("{phone}", urllib.parse.quote(phone)).replace("{phone_digits}", urllib.parse.quote(digits))
                   .replace("{message}", urllib.parse.quote(text)))
            req = urllib.request.Request(url, headers={"User-Agent": "ProblemHunt/3.0"})
        with urllib.request.urlopen(req, timeout=15) as r:  # noqa: S310 - admin-configured gateway
            return (200 <= r.status < 300), f"HTTP {r.status}"
    except urllib.error.HTTPError as e:
        return False, f"SMS gateway HTTP {e.code}"
    except Exception as exc:
        log.warning("sms send failed: %s", exc)
        return False, f"SMS failed: {exc.__class__.__name__}"
