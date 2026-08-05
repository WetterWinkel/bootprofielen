/* eslint-disable no-undef, react/prop-types */
import { useEffect, useState } from "preact/hooks";

const API_URL = "https://bootprofielen.onrender.com/api/captain-ai";

function productPrice(product) {
  const amount = Number(product.price);
  if (!Number.isFinite(amount)) return "";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: product.currency || "EUR",
  }).format(amount);
}

export function CaptainAi({ profileId, profile }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [notice, setNotice] = useState("");
  const [consent, setConsent] = useState(false);

  async function request(method, body, query = "") {
    const token = await globalThis.shopify.sessionToken.get();
    const result = await fetch(`${API_URL}${query}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const raw = await result.text();
    let json = {};
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      json = {};
    }
    if (!result.ok || !json.success) {
      throw new Error(
        json.message || `Captain AI reageerde niet (status ${result.status}).`,
      );
    }
    return json;
  }

  async function loadConversation() {
    if (!profileId) return;
    setLoading(true);
    setNotice("");
    try {
      const json = await request(
        "GET",
        null,
        `?profileId=${encodeURIComponent(profileId)}`,
      );
      const conversation = json.conversation;
      setConversationId(conversation?.id || "");
      setMessages(conversation?.messages || []);
      setConsent(Boolean(conversation?.improvementConsent));
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setConversationId("");
    setMessages([]);
    setQuestion("");
    setNotice("");
    setConsent(false);
    if (open && profileId) loadConversation();
    // Een profielwissel reset bewust de chat; openen laadt het gesprek via toggle().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && profileId && !conversationId && messages.length === 0) {
      await loadConversation();
    }
  }

  async function ask() {
    const value = question.trim();
    if (!value || busy) return;
    setBusy(true);
    setNotice("");
    const localId = `local-${Date.now()}`;
    setMessages((old) => [
      ...old,
      { id: localId, role: "USER", content: value },
    ]);
    setQuestion("");
    try {
      const json = await request("POST", {
        intent: "ask",
        profileId,
        conversationId,
        message: value,
        improvementConsent: consent,
      });
      setConversationId(json.conversationId || conversationId);
      setMessages((old) => [...old, json.message]);
    } catch (error) {
      setMessages((old) => old.filter((message) => message.id !== localId));
      setQuestion(value);
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function newConversation() {
    if (!profileId || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const json = await request("POST", {
        intent: "new_conversation",
        profileId,
        improvementConsent: consent,
      });
      setConversationId(json.conversation?.id || "");
      setMessages([]);
      setQuestion("");
      setNotice("Nieuw gesprek gestart.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteConversation() {
    if (!conversationId || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const json = await request("POST", {
        intent: "delete_conversation",
        profileId,
        conversationId,
      });
      setConversationId("");
      setMessages([]);
      setQuestion("");
      setNotice(json.message || "Gesprek verwijderd.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function feedback(messageId, value) {
    try {
      await request("POST", {
        intent: "feedback",
        profileId,
        conversationId,
        messageId,
        feedback: value,
      });
      setMessages((old) =>
        old.map((message) =>
          message.id === messageId ? { ...message, feedback: value } : message,
        ),
      );
      setNotice("Bedankt voor uw feedback.");
    } catch (error) {
      setNotice(error.message);
    }
  }

  const boatName =
    profile?.data?.naam_schip || profile?.data?.model_boot || "deze boot";

  return (
    <s-stack gap="base">
      <s-button onClick={toggle} disabled={!profileId}>
        {open ? "▼ Captain AI sluiten" : "▶ Captain AI openen"}
      </s-button>

      {open && (
        <s-box padding="base" border="base" borderRadius="base">
          <s-stack gap="base">
            <s-image
              src="https://bootprofielen.onrender.com/captain-ai.png"
              alt="Captain AI van WetterWinkel"
              aspectRatio="1/1"
            />
            <s-heading>Captain AI voor {boatName}</s-heading>
            <s-text>
              Captain AI gebruikt uw bootprofiel en Digitaal serviceboek, kan
              actuele technische bronnen raadplegen en adviseert uitsluitend
              producten uit het WetterWinkel-assortiment.
            </s-text>
            <s-text>
              Adviezen zijn ondersteunend. Controleer veiligheidskritische
              werkzaamheden altijd met de handleiding en zo nodig een
              vakbedrijf.
            </s-text>
            <s-text>
              Uw gesprekken worden veilig bij dit klantaccount en bootprofiel
              opgeslagen. U kunt een gesprek hieronder verwijderen.
            </s-text>

            <s-checkbox
              label="Mijn feedback mag geanonimiseerd worden gebruikt om Captain AI gecontroleerd te verbeteren"
              checked={consent}
              onChange={(event) => setConsent(event.currentTarget.checked)}
            />

            {loading && <s-text>Gesprek laden...</s-text>}

            {messages.map((message) => (
              <s-box
                key={message.id}
                padding="base"
                border="base"
                borderRadius="base"
              >
                <s-stack gap="small-300">
                  <s-heading>
                    {message.role === "USER" ? "U" : "Captain AI"}
                  </s-heading>
                  <s-paragraph>{message.content}</s-paragraph>

                  {(message.sources || []).length > 0 && (
                    <s-stack gap="small-300">
                      <s-text>Gebruikte bronnen</s-text>
                      {message.sources.map((source, index) =>
                        source.url ? (
                          <s-link
                            key={`${source.url}-${index}`}
                            href={source.url}
                            target="_blank"
                          >
                            {source.title}
                          </s-link>
                        ) : (
                          <s-text key={`${source.title}-${index}`}>
                            Handleiding: {source.title}
                          </s-text>
                        ),
                      )}
                    </s-stack>
                  )}

                  {(message.products || []).length > 0 && (
                    <s-stack gap="small-300">
                      <s-text>Passend gevonden bij WetterWinkel</s-text>
                      {message.products.map((product) => (
                        <s-box
                          key={product.id}
                          padding="base"
                          border="base"
                          borderRadius="base"
                        >
                          <s-stack gap="small-300">
                            {product.imageUrl && (
                              <s-image
                                src={product.imageUrl}
                                alt={product.imageAlt || product.title}
                                aspectRatio="1/1"
                              />
                            )}
                            <s-heading>{product.title}</s-heading>
                            {productPrice(product) && (
                              <s-text>Vanaf {productPrice(product)}</s-text>
                            )}
                            <s-text>
                              {product.available
                                ? "Beschikbaar"
                                : "Beschikbaarheid controleren"}
                            </s-text>
                            <s-button href={product.url} target="_blank">
                              Bekijk bij WetterWinkel
                            </s-button>
                          </s-stack>
                        </s-box>
                      ))}
                    </s-stack>
                  )}

                  {message.role === "ASSISTANT" && (
                    <s-stack direction="inline" gap="small-300">
                      <s-button
                        onClick={() => feedback(message.id, 1)}
                        disabled={message.feedback === 1}
                      >
                        {message.feedback === 1 ? "✓ Nuttig" : "Nuttig"}
                      </s-button>
                      <s-button
                        onClick={() => feedback(message.id, -1)}
                        disabled={message.feedback === -1}
                      >
                        {message.feedback === -1 ? "✓ Niet goed" : "Niet goed"}
                      </s-button>
                    </s-stack>
                  )}
                </s-stack>
              </s-box>
            ))}

            <s-text-area
              label="Uw vraag aan Captain AI"
              value={question}
              disabled={busy}
              onInput={(event) => setQuestion(event.currentTarget.value)}
              onChange={(event) => setQuestion(event.currentTarget.value)}
            />
            <s-button
              onClick={ask}
              disabled={busy || !question.trim()}
              variant="primary"
            >
              {busy ? "Captain AI denkt na..." : "Vraag stellen"}
            </s-button>

            <s-stack direction="inline" gap="small-300">
              <s-button onClick={newConversation} disabled={busy}>
                Nieuw gesprek
              </s-button>
              {conversationId && (
                <s-button
                  onClick={deleteConversation}
                  disabled={busy}
                  tone="critical"
                >
                  Gesprek verwijderen
                </s-button>
              )}
            </s-stack>
            {notice && <s-text>{notice}</s-text>}
          </s-stack>
        </s-box>
      )}
    </s-stack>
  );
}
