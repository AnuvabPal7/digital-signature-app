package com.signature.signatureapp.controller;

import com.signature.signatureapp.model.Document;
import com.signature.signatureapp.model.Signature;
import com.signature.signatureapp.model.SignatureStatus;
import com.signature.signatureapp.repository.DocumentRepository;
import com.signature.signatureapp.service.AuditLogService;
import com.signature.signatureapp.service.S3StorageService;
import com.signature.signatureapp.service.SignatureService;
import com.signature.signatureapp.service.SignedDocumentService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/public")
public class PublicSigningController {

    private final SignatureService signatureService;
    private final DocumentRepository documentRepository;
    private final AuditLogService auditLogService;
    private final S3StorageService s3StorageService;
    private final SignedDocumentService signedDocumentService;

    public PublicSigningController(SignatureService signatureService,
                                     DocumentRepository documentRepository,
                                     AuditLogService auditLogService,
                                     S3StorageService s3StorageService,
                                     SignedDocumentService signedDocumentService) {
        this.signatureService = signatureService;
        this.documentRepository = documentRepository;
        this.auditLogService = auditLogService;
        this.s3StorageService = s3StorageService;
        this.signedDocumentService = signedDocumentService;
    }

    @GetMapping("/sign/{token}")
    public ResponseEntity<?> getSigningInfo(@PathVariable String token, HttpServletRequest request) {
        Signature signature = signatureService.findByToken(token);
        Document document = documentRepository.findById(signature.getDocumentId())
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));

        auditLogService.log(document.getId(), "VIEW", getClientIp(request));

        return ResponseEntity.ok(new SigningInfo(
                document.getFileName(),
                signature.getX(),
                signature.getY(),
                signature.getPageNumber(),
                signature.getStatus().name(),
                signature.getRejectionReason(),
                "/api/public/sign/" + token + "/view",
                signature.getSignerName(),
                signature.getFontName(),
                signature.getSignatureColor(),
                signature.getSignatureImageBase64() != null && !signature.getSignatureImageBase64().isBlank(),
                signature.getRole().name(),
                signature.getStatus() == SignatureStatus.SIGNED ? "/api/public/sign/" + token + "/download" : null
        ));
    }

    @GetMapping("/sign/{token}/view")
    public ResponseEntity<ByteArrayResource> viewDocument(@PathVariable String token) {
        Signature signature = signatureService.findByToken(token);
        Document document = documentRepository.findById(signature.getDocumentId())
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));

        byte[] fileBytes = s3StorageService.download(document.getFilePath());
        ByteArrayResource resource = new ByteArrayResource(fileBytes);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(fileBytes.length)
                .body(resource);
    }

    /**
     * VALIDATOR flow only - approves the signature the sender already placed.
     */
    @PostMapping("/sign/{token}/accept")
    public ResponseEntity<Signature> acceptSignature(@PathVariable String token, HttpServletRequest request) {
        Signature updated = signatureService.signByToken(token);
        auditLogService.log(updated.getDocumentId(), "SIGN", getClientIp(request));
        return ResponseEntity.ok(updated);
    }

    /**
     * SIGNER flow only - recipient submits their own typed/drawn signature to
     * fill the blank marker the sender positioned.
     *
     * Body: { "signerName": "...", "fontName": "...", "signatureColor": "R,G,B",
     *         "signatureImageBase64": "..." (optional if typed) }
     */
    @PostMapping("/sign/{token}/submit-signature")
    public ResponseEntity<Signature> submitSignature(@PathVariable String token,
                                                        @RequestBody Map<String, String> body,
                                                        HttpServletRequest request) {
        Signature updated = signatureService.submitSignerSignature(
                token,
                body.get("signerName"),
                body.get("fontName"),
                body.get("signatureColor"),
                body.get("signatureImageBase64")
        );
        auditLogService.log(updated.getDocumentId(), "SIGN", getClientIp(request));
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/sign/{token}/reject")
    public ResponseEntity<Signature> rejectSignature(@PathVariable String token,
                                                       @RequestBody(required = false) Map<String, String> body,
                                                       HttpServletRequest request) {
        String reason = body != null ? body.get("reason") : null;
        Signature updated = signatureService.rejectByToken(token, reason);
        auditLogService.log(updated.getDocumentId(), "REJECT", getClientIp(request));
        return ResponseEntity.ok(updated);
    }

    /**
     * Lets the recipient download the finalized (stamped) PDF once they've
     * completed their part. Gated on this signature's own status being
     * SIGNED - a recipient can't download before they've acted, and the
     * token itself is the only credential needed (same trust model as the
     * /view endpoint above).
     */
    @GetMapping("/sign/{token}/download")
    public ResponseEntity<ByteArrayResource> downloadSignedDocument(@PathVariable String token) {
        Signature signature = signatureService.findByToken(token);
        if (signature.getStatus() != SignatureStatus.SIGNED) {
            throw new IllegalStateException("This document hasn't been signed yet.");
        }

        byte[] signedBytes;
        try {
            signedBytes = signedDocumentService.generateSignedPdf(signature.getDocumentId());
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate the signed document.", e);
        }

        ByteArrayResource resource = new ByteArrayResource(signedBytes);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"signed-document.pdf\"")
                .contentLength(signedBytes.length)
                .body(resource);
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    record SigningInfo(String fileName, int x, int y, int pageNumber, String status, String rejectionReason,
                        String viewUrl, String signerName, String fontName, String signatureColor,
                        boolean hasDrawnImage, String role, String downloadUrl) {
    }
}
