package com.signature.signatureapp.controller;

import com.signature.signatureapp.service.AuditLogService;
import com.signature.signatureapp.service.SignedDocumentService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

@RestController
@RequestMapping("/api/signature")
public class SignedDocumentController {

    private final SignedDocumentService signedDocumentService;
    private final AuditLogService auditLogService;

    public SignedDocumentController(SignedDocumentService signedDocumentService,
                                     AuditLogService auditLogService) {
        this.signedDocumentService = signedDocumentService;
        this.auditLogService = auditLogService;
    }

    /**
     * Generates the signed PDF (embedding all saved signatures) and
     * streams it back to the client as a downloadable file.
     *
     * FIX: signedDocumentService now returns bytes generated in memory
     * (source pulled from S3) instead of a File written to local disk.
     */
    @GetMapping("/generate/{documentId}")
    public ResponseEntity<ByteArrayResource> generateSignedPdf(@PathVariable Long documentId,
                                                                 HttpServletRequest request) throws IOException {
        byte[] signedPdfBytes = signedDocumentService.generateSignedPdf(documentId);

        auditLogService.log(documentId, "SIGNED_PDF_GENERATED", getClientIp(request));

        ByteArrayResource resource = new ByteArrayResource(signedPdfBytes);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"signed_document.pdf\"")
                .contentLength(signedPdfBytes.length)
                .body(resource);
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
