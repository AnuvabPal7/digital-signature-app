package com.signature.signatureapp.service;

import com.signature.signatureapp.model.Document;
import com.signature.signatureapp.model.User;
import com.signature.signatureapp.repository.DocumentRepository;
import com.signature.signatureapp.repository.SignatureRepository;
import com.signature.signatureapp.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final SignatureRepository signatureRepository;
    private final S3StorageService s3StorageService;

    public DocumentService(DocumentRepository documentRepository,
                            UserRepository userRepository,
                            SignatureRepository signatureRepository,
                            S3StorageService s3StorageService) {
        this.documentRepository = documentRepository;
        this.userRepository = userRepository;
        this.signatureRepository = signatureRepository;
        this.s3StorageService = s3StorageService;
    }

    public Document uploadFile(MultipartFile file, Long userId) throws IOException {

        Optional<User> userOpt = userRepository.findById(userId);

        if (userOpt.isEmpty()) {
            throw new RuntimeException("User not found");
        }

        User user = userOpt.get();

        String originalName = file.getOriginalFilename();

        // FIX: previously written to the local `uploads/` folder, which
        // Render wipes on every restart/redeploy/spin-down. Now stored in
        // S3, which survives all of those.
        String s3Key = UUID.randomUUID() + "_" + originalName;
        s3StorageService.upload(file, s3Key);

        Document doc = new Document();
        doc.setFileName(originalName);
        // `filePath` now holds the S3 object key rather than a local path.
        // Kept the field name to avoid a DB migration for a rename.
        doc.setFilePath(s3Key);
        doc.setFileType(file.getContentType());
        doc.setFileSize(file.getSize());
        doc.setUser(user);

        return documentRepository.save(doc);
    }

    public List<Document> getUserDocuments(Long userId) {
        return documentRepository.findByUserId(userId);
    }

    public Document getDocumentById(Long id) {
        return documentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Document not found"));
    }

    public void deleteDocument(Long id) {
        Document doc = documentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Document not found"));

        // Remove any signatures associated with this document first
        signatureRepository.deleteAll(signatureRepository.findByDocumentId(id));

        // FIX: delete the S3 object instead of a local File
        s3StorageService.delete(doc.getFilePath());

        documentRepository.delete(doc);
    }
}
