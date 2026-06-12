package com.signature.signatureapp.controller;

import com.signature.signatureapp.model.AuditLog;
import com.signature.signatureapp.repository.AuditLogRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/audit")
public class AuditLogController {

    private final AuditLogRepository auditLogRepository;

    public AuditLogController(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @GetMapping("/{documentId}")
    public List<AuditLog> getAuditTrail(@PathVariable Long documentId) {
        return auditLogRepository.findByDocumentIdOrderByTimestampDesc(documentId);
    }
}