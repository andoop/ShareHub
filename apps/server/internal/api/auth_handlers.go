package api

import (
	"encoding/json"
	"net/http"

	"github.com/local/sharehub/internal/auth"
)

type AuthHandler struct {
	auth *auth.Service
}

func NewAuthHandler(a *auth.Service) *AuthHandler {
	return &AuthHandler{auth: a}
}

type loginRequest struct {
	User string `json:"user"`
	Pass string `json:"pass"`
}

type loginResponse struct {
	Token string `json:"token"`
	User  string `json:"user"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确", "BAD_REQUEST")
		return
	}
	if req.User == "" || req.Pass == "" {
		writeError(w, http.StatusBadRequest, "请输入用户名和密码", "BAD_REQUEST")
		return
	}
	token, err := h.auth.Login(req.User, req.Pass)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "用户名或密码错误", "UNAUTHORIZED")
		return
	}
	writeJSON(w, http.StatusOK, loginResponse{Token: token, User: req.User})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(auth.UserContextKey).(string)
	writeJSON(w, http.StatusOK, map[string]string{"user": user})
}
