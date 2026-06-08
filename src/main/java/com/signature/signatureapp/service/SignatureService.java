package com.signature.signatureapp.service;

import com.signature.signatureapp.model.Signature;
import com.signature.signatureapp.repository.SignatureRepository;
import org.springframework.stereotype.Service;

@Service
public class SignatureService {

    private final SignatureRepository signatureRepository;

    public SignatureService(SignatureRepository signatureRepository) {
        this.signatureRepository = signatureRepository;
    }

    public Signature saveSignature(Signature signature) {
        return signatureRepository.save(signature);
    }
}