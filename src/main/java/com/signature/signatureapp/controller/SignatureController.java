package com.signature.signatureapp.controller;

import com.signature.signatureapp.model.Signature;
import com.signature.signatureapp.service.SignatureService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

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

    /**
     * Generates a public signing token (if needed) and emails the link
     * to the given recipient.
     *
     * Body: { "email": "recipient@example.com" }
     */
    @PostMapping("/{id}/send-link")
    public ResponseEntity<Signature> sendSigningLink(@PathVariable Long id,
                                                       @RequestBody Map<String, String> body) {
        String email = body.get("email");
        Signature updated = signatureService.sendSigningLink(id, email);
        return ResponseEntity.ok(updated);
    }
}