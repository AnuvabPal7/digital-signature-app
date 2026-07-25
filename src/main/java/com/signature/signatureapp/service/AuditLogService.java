package com.signature.signatureapp.service;

import com.signature.signatureapp.model.AuditLog;
import com.signature.signatureapp.repository.AuditLogRepository;
import org.springframework.stereotype.Service;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    public AuditLogService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    public void log(Long documentId, String action, String ipAddress) {
        auditLogRepository.save(new AuditLog(documentId, action, ipAddress));
    }
}