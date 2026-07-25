package com.signature.signatureapp.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.Map;

@Service
public class EmailService {

    @Value("${app.base-url}")
    private String baseUrl;

    @Value("${app.frontend-url:${app.base-url}}")
    private String frontendUrl;

    @Value("${resend.api-key}")
    private String resendApiKey;

    @Value("${resend.from-email}")
    private String fromEmail;

    private final RestTemplate restTemplate = new RestTemplate();

    public void sendSigningLink(String toEmail, String documentName, String token) {
        String link = frontendUrl + "/sign/" + token;

        String htmlBody = "<p>Hello,</p>" +
                "<p>You have been requested to review and sign the document: <strong>" + documentName + "</strong></p>" +
                "<p><a href=\"" + link + "\">Click here to view and sign the document</a></p>" +
                "<p>If you were not expecting this email, you can safely ignore it.</p>" +
                "<p>Regards,<br/>SecureSign</p>";

        Map<String, Object> payload = Map.of(
                "from", fromEmail,
                "to", new String[]{toEmail},
                "subject", "Action Required: Sign \"" + documentName + "\"",
                "html", htmlBody
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(resendApiKey);

        RequestEntity<Map<String, Object>> request = new RequestEntity<>(
                payload, headers, org.springframework.http.HttpMethod.POST, URI.create("https://api.resend.com/emails"));

        ResponseEntity<String> response = restTemplate.exchange(request, String.class);

        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new RuntimeException("Failed to send email via Resend: " + response.getBody());
        }
    }
}