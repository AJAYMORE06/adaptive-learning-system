import os
import smtplib
from email.message import EmailMessage


def send_password_reset_email(
    recipient: str,
    reset_link: str,
) -> None:
    message = EmailMessage()
    message["Subject"] = "Reset your IntelliPrep password"
    message["From"] = os.environ["EMAIL_FROM"]
    message["To"] = recipient

    message.set_content(
        f"""Hello,

We received a request to reset your IntelliPrep password.

Use the following link to choose a new password.
This link expires in 30 minutes.

{reset_link}

If you did not request this, you can ignore this email.

IntelliPrep Team
"""
    )

    with smtplib.SMTP(
        os.getenv("SMTP_HOST", "smtp.gmail.com"),
        int(os.getenv("SMTP_PORT", "587")),
        timeout=15,
    ) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.ehlo()

        smtp.login(
            os.environ["SMTP_USERNAME"],
            os.environ["SMTP_PASSWORD"],
        )

        smtp.send_message(message)
