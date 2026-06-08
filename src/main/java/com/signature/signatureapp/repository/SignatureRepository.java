package com.signature.signatureapp.repository;

import com.signature.signatureapp.model.Signature;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SignatureRepository extends JpaRepository<Signature, Long> {
}