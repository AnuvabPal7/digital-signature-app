package com.signature.signatureapp.controller;

import com.signature.signatureapp.model.Signature;
import com.signature.signatureapp.service.SignatureService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/signature")
public class SignatureController {

    private final SignatureService signatureService;

    public SignatureController(SignatureService signatureService) {
        this.signatureService = signatureService;
    }

    @PostMapping("/save")
    public ResponseEntity<Signature> saveSignature(@RequestBody Signature signature) {
        Signature saved = signatureService.saveSignature(signature);
        return ResponseEntity.ok(saved);
    }
}