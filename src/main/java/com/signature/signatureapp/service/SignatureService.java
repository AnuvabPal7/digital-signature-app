package com.signature.signatureapp.service;

import com.signature.signatureapp.model.Document;
import com.signature.signatureapp.model.Signature;
import com.signature.signatureapp.model.SignatureRole;
import com.signature.signatureapp.model.SignatureStatus;
import com.signature.signatureapp.repository.DocumentRepository;
import com.signature.signatureapp.repository.SignatureRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class SignatureService {

    private final SignatureRepository signatureRepository;
    private final DocumentRepository documentRepository;
    private final EmailService emailService;

    public SignatureService(SignatureRepository signatureRepository,
                             DocumentRepository documentRepository,
                             EmailService emailService) {
        this.signatureRepository = signatureRepository;
        this.documentRepository = documentRepository;
        this.emailService = emailService;
    }

    public Signature saveSignature(Signature signature) {
        return signatureRepository.save(signature);
    }

    /**
     * Generates (or reuses) a public token for the given signature, persists
     * the recipient's email onto the row (needed so the backend can later
     * auto-email the next person in a sequence without the frontend telling
     * it who that is), then emails the signing link.
     */
    public Signature sendSigningLink(Long signatureId, String recipientEmail) {
        Signature signature = signatureRepository.findById(signatureId)
                .orElseThrow(() -> new IllegalArgumentException("Signature not found: " + signatureId));

        boolean changed = false;
        if (signature.getToken() == null || signature.getToken().isBlank()) {
            signature.setToken(UUID.randomUUID().toString());
            changed = true;
        }
        if (recipientEmail != null && !recipientEmail.isBlank()
                && !recipientEmail.equals(signature.getRecipientEmail())) {
            signature.setRecipientEmail(recipientEmail);
            changed = true;
        }
        if (changed) {
            signature = signatureRepository.save(signature);
        }
        final Signature finalSignature = signature; // must be effectively final to use inside the lambda below

        Document document = documentRepository.findById(finalSignature.getDocumentId())
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + finalSignature.getDocumentId()));

        emailService.sendSigningLink(finalSignature.getRecipientEmail(), document.getFileName(), finalSignature.getToken(), finalSignature.getRole().name());

        return finalSignature;
    }

    /**
     * Kicks off sending for a whole document's recipient list, after every
     * recipient row has already been created via saveSignature.
     *
     * orderEnabled = false -> every recipient is emailed immediately.
     * orderEnabled = true  -> only the recipient with signOrder == 1 is
     *                         emailed now; everyone else waits until the
     *                         person before them completes (signs, or
     *                         declines and gets skipped) - see advanceSequence.
     */
    public void startSequence(Long documentId, boolean orderEnabled) {
        List<Signature> recipients = signatureRepository.findByDocumentId(documentId);

        if (!orderEnabled) {
            for (Signature s : recipients) {
                if (s.getRecipientEmail() != null && !s.getRecipientEmail().isBlank()) {
                    sendSigningLink(s.getId(), s.getRecipientEmail());
                }
            }
            return;
        }

        recipients.stream()
                .filter(s -> Integer.valueOf(1).equals(s.getSignOrder()))
                .findFirst()
                .ifPresent(first -> sendSigningLink(first.getId(), first.getRecipientEmail()));
    }

    /**
     * After a recipient completes their action (signed, or declined and is
     * being skipped), finds the next recipient in the sequence - by
     * signOrder, server-side - and emails them. Does nothing if this
     * signature wasn't part of an ordered sequence, or if it was the last one.
     */
    private void advanceSequence(Signature completed) {
        if (completed.getSignOrder() == null) return;

        Optional<Signature> next = signatureRepository
                .findFirstByDocumentIdAndSignOrderGreaterThanAndStatusOrderBySignOrderAsc(
                        completed.getDocumentId(), completed.getSignOrder(), SignatureStatus.PENDING);

        next.ifPresent(n -> sendSigningLink(n.getId(), n.getRecipientEmail()));
    }

    public Signature findByToken(String token) {
        return signatureRepository.findByToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired signing link"));
    }

    /**
     * VALIDATOR flow: recipient accepts/witnesses a signature the sender
     * already placed. No new signature content is created here.
     */
    public Signature signByToken(String token) {
        Signature signature = findByToken(token);
        signature.setStatus(SignatureStatus.SIGNED);
        signature.setRejectionReason(null);
        Signature saved = signatureRepository.save(signature);
        advanceSequence(saved);
        return saved;
    }

    /**
     * SIGNER flow: recipient creates their own signature (typed or drawn) at
     * the position the sender marked. Rejects if this row isn't actually a
     * SIGNER row - a VALIDATOR can't submit signature content, and a SIGNER
     * can't be accepted via the VALIDATOR endpoint.
     */
    public Signature submitSignerSignature(String token, String signerName, String fontName,
                                            String signatureColor, String signatureImageBase64) {
        Signature signature = findByToken(token);
        if (signature.getRole() != SignatureRole.SIGNER) {
            throw new IllegalStateException("This signing request does not require a new signature.");
        }
        if ((signerName == null || signerName.isBlank())
                && (signatureImageBase64 == null || signatureImageBase64.isBlank())) {
            throw new IllegalArgumentException("Provide a typed name or a drawn signature.");
        }

        signature.setSignerName(signerName);
        signature.setFontName(fontName);
        signature.setSignatureColor(signatureColor);
        signature.setSignatureImageBase64(signatureImageBase64);
        signature.setStatus(SignatureStatus.SIGNED);
        signature.setRejectionReason(null);

        Signature saved = signatureRepository.save(signature);
        advanceSequence(saved);
        return saved;
    }

    /**
     * Recipient rejects the signing request via the public token link, with
     * an optional reason. Per design: a decline does NOT halt a sequential
     * chain - the next recipient still gets emailed.
     */
    public Signature rejectByToken(String token, String reason) {
        Signature signature = findByToken(token);
        signature.setStatus(SignatureStatus.REJECTED);
        signature.setRejectionReason(reason);
        Signature saved = signatureRepository.save(signature);
        advanceSequence(saved);
        return saved;
    }
}
