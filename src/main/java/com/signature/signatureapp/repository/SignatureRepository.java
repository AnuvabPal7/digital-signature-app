package com.signature.signatureapp.repository;

import com.signature.signatureapp.model.Signature;
import com.signature.signatureapp.model.SignatureStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SignatureRepository extends JpaRepository<Signature, Long> {
    List<Signature> findByDocumentId(Long documentId);
    Optional<Signature> findByToken(String token);

    // Used to find the next recipient in a sequential ("Set order of receivers")
    // chain: the PENDING row for this document with the smallest signOrder that
    // is still greater than the one that just completed (signed, or declined and
    // skipped). Ordering is enforced here, server-side - the frontend never gets
    // to decide who's next.
    Optional<Signature> findFirstByDocumentIdAndSignOrderGreaterThanAndStatusOrderBySignOrderAsc(
            Long documentId, Integer signOrder, SignatureStatus status);
}
