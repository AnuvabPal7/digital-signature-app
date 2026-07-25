package com.signature.signatureapp.repository;

import com.signature.signatureapp.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findByDocumentIdOrderByTimestampDesc(Long documentId);
}