package com.signature.signatureapp.config;

import com.signature.signatureapp.model.User;
import com.signature.signatureapp.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Optional;

/**
 * FIX: this filter did not exist before. JwtUtils could generate and verify
 * tokens, but nothing ever read the Authorization header on incoming
 * requests, so every JWT was decorative and every endpoint effectively
 * trusted whatever the client claimed about itself (e.g. a raw "userId"
 * request param). This filter runs once per request, validates the bearer
 * token if present, and - if valid - sets the authenticated User as the
 * request's principal so controllers can trust SecurityContextHolder
 * instead of client-supplied identifiers.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtils jwtUtils;
    private final UserRepository userRepository;

    public JwtAuthFilter(JwtUtils jwtUtils, UserRepository userRepository) {
        this.jwtUtils = jwtUtils;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                     @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);

            if (jwtUtils.validateToken(token)) {
                String email = jwtUtils.getEmailFromToken(token);
                Optional<User> userOpt = userRepository.findByEmail(email);

                if (userOpt.isPresent() && SecurityContextHolder.getContext().getAuthentication() == null) {
                    User user = userOpt.get();
                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(user, null, Collections.emptyList());
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
            // If the token is missing/invalid we deliberately do NOT reject here -
            // SecurityConfig's authorizeHttpRequests() is what enforces access,
            // this filter's only job is to populate identity when a valid token exists.
        }

        filterChain.doFilter(request, response);
    }
}
