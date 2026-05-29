from __future__ import annotations

import argparse
import mimetypes
import os
import smtplib
from email.message import EmailMessage
from pathlib import Path


ATTACHMENTS = [
    "worlded-leads.csv",
    "worlded-leads.html",
    "worlded-leads.json",
    "new-leads.csv",
    "new-leads.json",
    "long-list.csv",
    "long-list.json",
    "summary.md",
    "operational-status.json",
]


def send_email(run_dir: Path) -> bool:
    server = os.environ.get("SMTP_SERVER", "")
    username = os.environ.get("SMTP_USERNAME", "")
    password = os.environ.get("SMTP_PASSWORD", "")
    sender = os.environ.get("SMTP_FROM", "")
    port = int(os.environ.get("SMTP_PORT") or "587")
    if not all([server, username, password, sender]):
        print("Email not sent: SMTP secrets are not fully configured.")
        return False

    message = EmailMessage()
    message["To"] = (run_dir / "email-to.txt").read_text(encoding="utf-8").strip()
    message["From"] = sender
    message["Subject"] = (run_dir / "email-subject.txt").read_text(encoding="utf-8").strip()
    message.set_content((run_dir / "email-body.txt").read_text(encoding="utf-8"))

    for name in ATTACHMENTS:
        path = run_dir / name
        if not path.exists():
            continue
        ctype, encoding = mimetypes.guess_type(str(path))
        if ctype is None or encoding is not None:
            ctype = "application/octet-stream"
        maintype, subtype = ctype.split("/", 1)
        message.add_attachment(path.read_bytes(), maintype=maintype, subtype=subtype, filename=name)

    if port == 465:
        with smtplib.SMTP_SSL(server, port) as smtp:
            smtp.login(username, password)
            smtp.send_message(message)
    else:
        with smtplib.SMTP(server, port) as smtp:
            smtp.starttls()
            smtp.login(username, password)
            smtp.send_message(message)
    print(f"Email sent to {message['To']}")
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-dir", required=True)
    args = parser.parse_args()
    send_email(Path(args.run_dir))


if __name__ == "__main__":
    main()
