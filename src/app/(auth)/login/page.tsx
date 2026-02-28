"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Package, Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";

type AuthMode = "login" | "signup";

export default function LoginPage() {
    const router = useRouter();
    const [mode, setMode] = useState<AuthMode>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!email || !password) {
            setError("Completá email y contraseña.");
            return;
        }

        if (mode === "signup" && password !== confirmPassword) {
            setError("Las contraseñas no coinciden.");
            return;
        }

        if (password.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres.");
            return;
        }

        setLoading(true);
        const supabase = createClient();

        if (mode === "login") {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (authError) {
                setError(
                    authError.message === "Invalid login credentials"
                        ? "Email o contraseña incorrectos."
                        : authError.message
                );
                setLoading(false);
                return;
            }
            router.push("/");
            router.refresh();
        } else {
            const { error: authError } = await supabase.auth.signUp({
                email,
                password,
            });
            if (authError) {
                setError(authError.message);
                setLoading(false);
                return;
            }
            setSuccess(
                "Cuenta creada. Revisá tu email para confirmar la cuenta."
            );
            setLoading(false);
        }
    }

    function switchMode() {
        setMode(mode === "login" ? "signup" : "login");
        setError(null);
        setSuccess(null);
        setConfirmPassword("");
    }

    return (
        <div className="login-container">
            <div className="login-card">
                {/* ── Logo ── */}
                <div className="login-logo">
                    <div className="login-logo-icon">
                        <Package size={24} color="white" strokeWidth={1.5} />
                    </div>
                    <h1 className="login-title">NexoStock</h1>
                    <p className="login-subtitle">
                        {mode === "login"
                            ? "Iniciá sesión para continuar"
                            : "Creá tu cuenta"}
                    </p>
                </div>

                {/* ── Mode toggle ── */}
                <div className="login-tabs">
                    <button
                        className={`login-tab ${mode === "login" ? "active" : ""}`}
                        onClick={() => switchMode()}
                        type="button"
                        disabled={mode === "login"}
                    >
                        Iniciar sesión
                    </button>
                    <button
                        className={`login-tab ${mode === "signup" ? "active" : ""}`}
                        onClick={() => switchMode()}
                        type="button"
                        disabled={mode === "signup"}
                    >
                        Crear cuenta
                    </button>
                </div>

                {/* ── Error / Success banners ── */}
                {error && <div className="login-error">{error}</div>}
                {success && <div className="login-success">{success}</div>}

                {/* ── Form ── */}
                <form onSubmit={handleSubmit} className="login-form">
                    <div className="login-field">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            placeholder="tu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            required
                        />
                    </div>

                    <div className="login-field">
                        <label htmlFor="password">Contraseña</label>
                        <div className="login-password-wrapper">
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete={
                                    mode === "login" ? "current-password" : "new-password"
                                }
                                required
                            />
                            <button
                                type="button"
                                className="login-password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={
                                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                                }
                                tabIndex={-1}
                            >
                                {showPassword ? (
                                    <EyeOff size={18} strokeWidth={1.5} />
                                ) : (
                                    <Eye size={18} strokeWidth={1.5} />
                                )}
                            </button>
                        </div>
                    </div>

                    {mode === "signup" && (
                        <div className="login-field">
                            <label htmlFor="confirm-password">Confirmar contraseña</label>
                            <input
                                id="confirm-password"
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                autoComplete="new-password"
                                required
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        className="login-submit"
                        disabled={loading}
                    >
                        {loading ? (
                            <Loader2 size={18} className="spin" />
                        ) : (
                            <>
                                {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
                                <ArrowRight size={16} strokeWidth={2} />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
