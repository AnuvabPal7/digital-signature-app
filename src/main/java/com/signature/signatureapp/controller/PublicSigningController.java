package com.signature.signatureapp.controller;

import com.signature.signatureapp.model.Document;
import com.signature.signatureapp.model.Signature;
import com.signature.signatureapp.repository.DocumentRepository;
import com.signature.signatureapp.service.AuditLogService;
import com.signature.signatureapp.service.SignatureService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.util.Map;

@RestController
@RequestMapping("/api/public")
public class PublicSigningController {

    private final SignatureService signatureService;
    private final DocumentRepository documentRepository;
    private final AuditLogService auditLogService;

    public PublicSigningController(SignatureService signatureService,
                                     DocumentRepository documentRepository,
                                     AuditLogService auditLogService) {
        this.signatureService = signatureService;
        this.documentRepository = documentRepository;
        this.auditLogService = auditLogService;
    }

    /**
     * Public landing endpoint — returns basic info about the document
     * waiting to be signed, identified purely by the token.
     */
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
                "/api/public/sign/" + token + "/view"
        ));
    }

    /**
     * Streams the actual PDF for the recipient to view, no login required.
     */
    @GetMapping("/sign/{token}/view")
    public ResponseEntity<FileSystemResource> viewDocument(@PathVariable String token) {
        Signature signature = signatureService.findByToken(token);
        Document document = documentRepository.findById(signature.getDocumentId())
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));

        File file = new File(document.getFilePath());
        FileSystemResource resource = new FileSystemResource(file);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(file.length())
                .body(resource);
    }

    /**
     * Recipient confirms/accepts the signature placement -> status becomes SIGNED.
     */
    @PostMapping("/sign/{token}/accept")
    public ResponseEntity<Signature> acceptSignature(@PathVariable String token, HttpServletRequest request) {
        Signature updated = signatureService.signByToken(token);
        auditLogService.log(updated.getDocumentId(), "SIGN", getClientIp(request));
        return ResponseEntity.ok(updated);
    }

    /**
     * Recipient rejects the signing request, optionally with a reason.
     * Body: { "reason": "..." }
     */
    @PostMapping("/sign/{token}/reject")
    public ResponseEntity<Signature> rejectSignature(@PathVariable String token,
                                                       @RequestBody(required = false) Map<String, String> body,
                                                       HttpServletRequest request) {
        String reason = body != null ? body.get("reason") : null;
        Signature updated = signatureService.rejectByToken(token, reason);
        auditLogService.log(updated.getDocumentId(), "REJECT", getClientIp(request));
        return ResponseEntity.ok(updated);
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    /**
     * Small response payload describing what needs to be signed.
     */
    record SigningInfo(String fileName, int x, int y, int pageNumber, String status, String rejectionReason, String viewUrl) {
    }
}