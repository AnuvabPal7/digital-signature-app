package com.signature.signatureapp.service;

import com.signature.signatureapp.model.Document;
import com.signature.signatureapp.model.Signature;
import com.signature.signatureapp.repository.DocumentRepository;
import com.signature.signatureapp.repository.SignatureRepository;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class SignatureService {

    private final SignatureRepository signatureRepository;
    private final DocumentRepository documentRepository;
    private final EmailService emailService;

    public SignatureService(SignatureRepository signatureRepository,
                             DocumentRepository documentRepository,
                             EmailService emailService) {
        this.signatureRepository = signatureRepository;
        this.documentRepository = documentRepository;
        this.emailService = emailService;
    }

    public Signature saveSignature(Signature signature) {
        return signatureRepository.save(signature);
    }

    /**
     * Generates (or reuses) a public token for the given signature,
     * then emails a signing link to the recipient.
     */
    public Signature sendSigningLink(Long signatureId, String recipientEmail) {
        Signature signature = signatureRepository.findById(signatureId)
                .orElseThrow(() -> new IllegalArgumentException("Signature not found: " + signatureId));

        if (signature.getToken() == null || signature.getToken().isBlank()) {
            signature.setToken(UUID.randomUUID().toString());
            signature = signatureRepository.save(signature);
        }

        final Signature finalSignature = signature;

        Document document = documentRepository.findById(finalSignature.getDocumentId())
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + finalSignature.getDocumentId()));

        emailService.sendSigningLink(recipientEmail, document.getFileName(), finalSignature.getToken());

        return finalSignature;
    }

    public Signature findByToken(String token) {
        return signatureRepository.findByToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired signing link"));
    }
}