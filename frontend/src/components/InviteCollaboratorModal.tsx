// frontend/src/components/InviteCollaboratorModal.tsx
import React, { useState } from "react";
import styled from "styled-components";
import { X, Mail, UserPlus, Check, AlertCircle, Loader2 } from "lucide-react";
import { apiFetch } from "../lib/apiClient";

type InviteCollaboratorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  tripId: number;
  tripTitle: string;
  isOwner?: boolean;
};

/* ========= Styled Components ========= */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background-color: rgba(0, 0, 0, 0.45);
  z-index: 2000;
  backdrop-filter: blur(4px);
`;

const Modal = styled.div`
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 2rem;
  background: #ffffff;
  border-radius: 1.25rem;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  color: #111827;
  position: relative;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  color: #6b7280;
  transition: all 0.2s;

  &:hover {
    background: #f3f4f6;
    color: #111827;
  }
`;

const Title = styled.h2`
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  color: #111827;
`;

const Subtitle = styled.p`
  font-size: 0.9rem;
  color: #6b7280;
  margin: 0 0 1.5rem 0;
`;

const InviteBox = styled.div`
  background: linear-gradient(135deg, #f5f7ff 0%, #e8edff 100%);
  border-radius: 16px;
  padding: 1.5rem;
  border: 1px solid #d0d9ff;
  margin-bottom: 1.5rem;
`;

const InviteTitle = styled.div`
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 1rem;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const InputArea = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: stretch;
`;

const Input = styled.input`
  flex: 1;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  border: 2px solid #e2e8f0;
  font-size: 0.95rem;
  font-family: inherit;
  transition: all 0.2s ease;
  background: white;
  outline: none;

  &:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  &::placeholder {
    color: #9ca3af;
  }
`;

const AddButton = styled.button`
  padding: 0.85rem 1.5rem;
  background: linear-gradient(135deg, #e8edff 0%, #dfe8ff 100%);
  color: #4f46e5;
  border-radius: 12px;
  border: 2px solid #c7d2fe;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.4rem;

  &:hover {
    background: linear-gradient(135deg, #dfe8ff 0%, #d0d9ff 100%);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const TagList = styled.div`
  margin-top: 1rem;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const Tag = styled.div`
  padding: 0.6rem 1rem;
  background: white;
  color: #667eea;
  border-radius: 30px;
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.85rem;
  font-weight: 500;
  border: 2px solid #e0e7ff;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
`;

const RemoveTagButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  transition: color 0.2s;

  &:hover {
    color: #ef4444;
  }
`;

const SendButton = styled.button`
  width: 100%;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
  color: white;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  box-shadow: 0 4px 15px rgba(79, 70, 229, 0.3);

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #4338ca 0%, #4f46e5 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(79, 70, 229, 0.4);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }
`;

const MessageBox = styled.div<{ $type: "error" | "success" }>`
  padding: 0.85rem 1rem;
  border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 500;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  ${(p) =>
    p.$type === "error"
      ? `
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
  `
      : `
    color: #10b981;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.2);
  `}
`;

const SentList = styled.div`
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
`;

const SentItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  font-size: 0.85rem;
  color: #059669;
`;

const Spinner = styled(Loader2)`
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const NonOwnerMessage = styled.div`
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid #f59e0b;
  border-radius: 12px;
  padding: 1.25rem;
  text-align: center;
  color: #92400e;
  font-size: 0.95rem;
  line-height: 1.5;
  margin-bottom: 1rem;

  strong {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 1rem;
    color: #78350f;
  }
`;

/* ========= Component ========= */

export default function InviteCollaboratorModal({
  isOpen,
  onClose,
  tripId,
  tripTitle,
  isOwner = true,
}: InviteCollaboratorModalProps) {
  const [pendingEmails, setPendingEmails] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [sentEmails, setSentEmails] = useState<string[]>([]);

  if (!isOpen) return null;

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const addEmail = () => {
    const email = inputValue.trim().toLowerCase();

    if (!email) {
      setError("Please enter an email address");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (pendingEmails.includes(email)) {
      setError("This email has already been added");
      return;
    }

    if (sentEmails.includes(email)) {
      setError("An invitation has already been sent to this email");
      return;
    }

    setPendingEmails([...pendingEmails, email]);
    setInputValue("");
    setError("");
  };

  const removeEmail = (email: string) => {
    setPendingEmails(pendingEmails.filter((e) => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addEmail();
    }
  };

  const sendInvitations = async () => {
    if (pendingEmails.length === 0) {
      setError("Please add at least one email address");
      return;
    }

    setSending(true);
    setError("");
    setSuccessMessage("");

    const successfulSends: string[] = [];
    const failedSends: { email: string; reason: string }[] = [];

    for (const email of pendingEmails) {
      try {
        await apiFetch(`/f1/trips/${tripId}/invite/`, {
          method: "POST",
          body: JSON.stringify({
            email: email,
            role: "editor",
          }),
        });
        successfulSends.push(email);
      } catch (err: any) {
        const errorMessage = err?.message || "Failed to send invitation";
        failedSends.push({ email, reason: errorMessage });
      }
    }

    // Update state based on results
    if (successfulSends.length > 0) {
      setSentEmails((prev) => [...prev, ...successfulSends]);
      setPendingEmails((prev) =>
        prev.filter((e) => !successfulSends.includes(e))
      );
      setSuccessMessage(
        `Successfully sent ${successfulSends.length} invitation${
          successfulSends.length > 1 ? "s" : ""
        }!`
      );
    }

    if (failedSends.length > 0) {
      setError(
        `Failed to send to: ${failedSends
          .map((f) => `${f.email} (${f.reason})`)
          .join(", ")}`
      );
    }

    setSending(false);

    // Dispatch event to refresh collaborator list
    if (successfulSends.length > 0) {
      window.dispatchEvent(
        new CustomEvent("trip-updated", { detail: { tripId } })
      );
    }
  };

  const handleClose = () => {
    // Reset state when closing
    setPendingEmails([]);
    setInputValue("");
    setError("");
    setSuccessMessage("");
    setSentEmails([]);
    onClose();
  };

  return (
    <Overlay onClick={handleClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <CloseButton onClick={handleClose} aria-label="Close">
          <X size={20} />
        </CloseButton>

        <Title>Invite Collaborators</Title>
        <Subtitle>
          Invite people to collaborate on "{tripTitle}"
        </Subtitle>

        {!isOwner ? (
          <NonOwnerMessage>
            <strong>Owner Access Required</strong>
            Only the owner of this trip can invite collaborators.
            Please contact the trip owner if you'd like to add more people.
          </NonOwnerMessage>
        ) : (
          <>
            {error && (
              <MessageBox $type="error">
                <AlertCircle size={18} />
                {error}
              </MessageBox>
            )}

            {successMessage && (
              <MessageBox $type="success">
                <Check size={18} />
                {successMessage}
              </MessageBox>
            )}

            <InviteBox>
              <InviteTitle>
                <Mail size={18} />
                Invite via email
              </InviteTitle>

              <InputArea>
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    setError("");
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                />
                <AddButton onClick={addEmail} disabled={sending}>
                  <UserPlus size={18} />
                  Add
                </AddButton>
              </InputArea>

              {pendingEmails.length > 0 && (
                <TagList>
                  {pendingEmails.map((email) => (
                    <Tag key={email}>
                      {email}
                      <RemoveTagButton
                        onClick={() => removeEmail(email)}
                        disabled={sending}
                        aria-label={`Remove ${email}`}
                      >
                        <X size={14} />
                      </RemoveTagButton>
                    </Tag>
                  ))}
                </TagList>
              )}
            </InviteBox>

            <SendButton
              onClick={sendInvitations}
              disabled={sending || pendingEmails.length === 0}
            >
              {sending ? (
                <>
                  <Spinner size={20} />
                  Sending invitations...
                </>
              ) : (
                <>
                  <Mail size={20} />
                  Send {pendingEmails.length > 0 ? pendingEmails.length : ""} Invitation
                  {pendingEmails.length !== 1 ? "s" : ""}
                </>
              )}
            </SendButton>
          </>
        )}

        {isOwner && sentEmails.length > 0 && (
          <SentList>
            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#374151",
                marginBottom: "0.5rem",
              }}
            >
              Invitations sent:
            </div>
            {sentEmails.map((email) => (
              <SentItem key={email}>
                <Check size={16} />
                {email}
              </SentItem>
            ))}
          </SentList>
        )}
      </Modal>
    </Overlay>
  );
}
