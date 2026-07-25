package com.signature.signatureapp.model;

import jakarta.persistence.*;

@Entity
public class Signature {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long documentId;

    private Long userId;

    private int x;

    private int y;

    private int pageNumber;

    @Column(unique = true)
    private String token;

    @Enumerated(EnumType.STRING)
    private SignatureStatus status = SignatureStatus.PENDING;

    private String rejectionReason;

    private String signerName;

    private String signatureColor; // stored as "R,G,B" e.g. "24,95,165"

    private String fontName; // e.g. "DancingScript", "Allura", "Caveat", "Plain"

    @Column(columnDefinition = "MEDIUMTEXT")
    private String signatureImageBase64; // base64 PNG for drawn signatures

    public Signature() {
    }

    public Long getId() {
        return id;
    }

    public Long getDocumentId() {
        return documentId;
    }

    public void setDocumentId(Long documentId) {
        this.documentId = documentId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public int getX() {
        return x;
    }

    public void setX(int x) {
        this.x = x;
    }

    public int getY() {
        return y;
    }

    public void setY(int y) {
        this.y = y;
    }

    public int getPageNumber() {
        return pageNumber;
    }

    public void setPageNumber(int pageNumber) {
        this.pageNumber = pageNumber;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public SignatureStatus getStatus() {
        return status;
    }

    public void setStatus(SignatureStatus status) {
        this.status = status;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }

    public String getSignerName() {
        return signerName;
    }

    public void setSignerName(String signerName) {
        this.signerName = signerName;
    }

    public String getSignatureColor() {
        return signatureColor;
    }

    public void setSignatureColor(String signatureColor) {
        this.signatureColor = signatureColor;
    }

    public String getFontName() {
        return fontName;
    }

    public void setFontName(String fontName) {
        this.fontName = fontName;
    }

    public String getSignatureImageBase64() {
        return signatureImageBase64;
    }

    public void setSignatureImageBase64(String signatureImageBase64) {
        this.signatureImageBase64 = signatureImageBase64;
    }
}