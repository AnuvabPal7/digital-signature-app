package com.signature.signatureapp.controller;

import com.signature.signatureapp.model.Document;
import com.signature.signatureapp.model.Signature;
import com.signature.signatureapp.repository.DocumentRepository;
import com.signature.signatureapp.service.SignatureService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.File;

@RestController
@RequestMapping("/api/public")
public class PublicSigningController {

    private final SignatureService signatureService;
    private final DocumentRepository documentRepository;

    public PublicSigningController(SignatureService signatureService,
                                     DocumentRepository documentRepository) {
        this.signatureService = signatureService;
        this.documentRepository = documentRepository;
    }

    /**
     * Public landing endpoint — returns basic info about the document
     * waiting to be signed, identified purely by the token.
     */
    @GetMapping("/sign/{token}")
    public ResponseEntity<?> getSigningInfo(@PathVariable String token) {
        Signature signature = signatureService.findByToken(token);
        Document document = documentRepository.findById(signature.getDocumentId())
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));

        return ResponseEntity.ok(new SigningInfo(
                document.getFileName(),
                signature.getX(),
                signature.getY(),
                signature.getPageNumber(),
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
     * Small response payload describing what needs to be signed.
     */
    record SigningInfo(String fileName, int x, int y, int pageNumber, String viewUrl) {
    }
}