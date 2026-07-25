package com.signature.signatureapp.controller;

import com.signature.signatureapp.service.AuditLogService;
import com.signature.signatureapp.service.SignedDocumentService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.File;
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
     */
    @GetMapping("/generate/{documentId}")
    public ResponseEntity<FileSystemResource> generateSignedPdf(@PathVariable Long documentId,
                                                                  HttpServletRequest request) throws IOException {
        File signedFile = signedDocumentService.generateSignedPdf(documentId);

        auditLogService.log(documentId, "SIGNED_PDF_GENERATED", getClientIp(request));

        FileSystemResource resource = new FileSystemResource(signedFile);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + signedFile.getName() + "\"")
                .contentLength(signedFile.length())
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