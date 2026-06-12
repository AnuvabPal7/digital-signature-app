package com.signature.signatureapp.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.base-url}")
    private String baseUrl;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendSigningLink(String toEmail, String documentName, String token) {
        String link = baseUrl + "/api/public/sign/" + token;

        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(toEmail);
        message.setSubject("Action Required: Sign \"" + documentName + "\"");
        message.setText(
                "Hello,\n\n" +
                "You have been requested to review and sign the document: " + documentName + "\n\n" +
                "Click the link below to view and sign the document:\n" + link + "\n\n" +
                "If you were not expecting this email, you can safely ignore it.\n\n" +
                "Regards,\nDocument Signature App"
        );

        mailSender.send(message);
    }
}