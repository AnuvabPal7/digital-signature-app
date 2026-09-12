package com.signature.signatureapp.controller;

import com.signature.signatureapp.model.Signature;
import com.signature.signatureapp.repository.SignatureRepository;
import com.signature.signatureapp.service.SignatureService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/signature")
public class SignatureController {

    private final SignatureService signatureService;
    private final SignatureRepository signatureRepository;

    public SignatureController(SignatureService signatureService,
                                SignatureRepository signatureRepository) {
        this.signatureService = signatureService;
        this.signatureRepository = signatureRepository;
    }

    @PostMapping("/save")
    public ResponseEntity<Signature> saveSignature(@RequestBody Signature signature) {
        Signature saved = signatureService.saveSignature(signature);
        return ResponseEntity.ok(saved);
    }

    /**
     * Generates a public signing token (if needed) and emails the link
     * to the given recipient. Used directly for the single-recipient
     * ("Several people", one email) flow.
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

    /**
     * Kicks off sending for a whole multi-recipient batch, after every
     * recipient's Signature row has already been created via /save.
     *
     * Body: { "documentId": 42, "orderEnabled": true }
     *
     * orderEnabled=false emails every recipient immediately.
     * orderEnabled=true emails only signOrder #1; the backend advances the
     * sequence itself as each recipient completes their action.
     */
    @PostMapping("/start-sequence")
    public ResponseEntity<Void> startSequence(@RequestBody Map<String, Object> body) {
        Long documentId = Long.valueOf(String.valueOf(body.get("documentId")));
        boolean orderEnabled = Boolean.TRUE.equals(body.get("orderEnabled"));
        signatureService.startSequence(documentId, orderEnabled);
        return ResponseEntity.ok().build();
    }

    /**
     * Returns all signature requests for a given document, including status.
     * Used by the dashboard to show Pending/Signed/Rejected badges.
     */
    @GetMapping("/document/{documentId}")
    public List<Signature> getSignaturesForDocument(@PathVariable Long documentId) {
        return signatureRepository.findByDocumentId(documentId);
    }
}
