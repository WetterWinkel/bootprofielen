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

async function fileBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary);
}

function selectedFiles(input) {
  if (Array.isArray(input)) return input;
  return Array.from(input?.currentTarget?.files || []);
}

function cleanAnswerText(value) {
  return String(value || "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1")
    .replace(/https?:\/\/[^\s)]+/g, "")
    .replace(/\((?:www\.)?[a-z0-9.-]+\.[a-z]{2,}\)/gi, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function parseAssistantAnswer(content) {
  const sections = [];
  let section = { heading: "Kort antwoord", blocks: [] };
  let paragraph = [];

  function flushParagraph() {
    const text = cleanAnswerText(paragraph.join(" "));
    if (text) section.blocks.push({ type: "paragraph", text });
    paragraph = [];
  }

  function flushSection() {
    flushParagraph();
    if (section.blocks.length) sections.push(section);
  }

  const lines = String(content || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+(#{1,4})\s+/g, "\n$1 ")
    .replace(/\s+(\*\*[^*]{2,80}\*\*:?)/g, "\n$1 ")
    .replace(/\s+(\d+[.)])\s+(?=[A-ZÀ-ÖØ-Þ])/g, "\n$1 ")
    .replace(/\s+-\s+(?=[A-ZÀ-ÖØ-Þ])/g, "\n- ")
    .split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    const markdownHeading = line.match(/^#{1,4}\s+(.+)$/);
    const boldHeading = line.match(/^\*\*([^*]{2,80})\*\*:?\s*(.*)$/);
    if (markdownHeading || boldHeading) {
      const heading = cleanAnswerText(
        markdownHeading ? markdownHeading[1] : boldHeading[1],
      );
      const remainder = boldHeading ? cleanAnswerText(boldHeading[2]) : "";
      flushSection();
      section = { heading: heading || "Advies", blocks: [] };
      if (remainder)
        section.blocks.push({ type: "paragraph", text: remainder });
      continue;
    }

    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    if (ordered || bullet) {
      flushParagraph();
      const type = ordered ? "ordered" : "unordered";
      const text = cleanAnswerText((ordered || bullet)[1]);
      const previous = section.blocks[section.blocks.length - 1];
      if (previous?.type === type) previous.items.push(text);
      else section.blocks.push({ type, items: [text] });
      continue;
    }

    paragraph.push(line);
  }

  flushSection();
  return sections.length
    ? sections
    : [
        {
          heading: "Kort antwoord",
          blocks: [{ type: "paragraph", text: cleanAnswerText(content) }],
        },
      ];
}

function parseStructuredAnswer(content) {
  try {
    const value = JSON.parse(String(content || ""));
    if (!value || typeof value !== "object" || !value.summary) return null;

    const list = (items, limit) =>
      Array.isArray(items)
        ? items.map(cleanAnswerText).filter(Boolean).slice(0, limit)
        : [];
    const allowedUrgencies = ["normal", "attention", "stop"];

    return {
      summary: cleanAnswerText(value.summary),
      urgency: allowedUrgencies.includes(value.urgency)
        ? value.urgency
        : "normal",
      safety: list(value.safety, 3),
      causes: list(value.causes, 4),
      checks: list(value.checks, 5),
      solution: list(value.solution, 4),
      followUp: cleanAnswerText(value.follow_up),
    };
  } catch {
    return null;
  }
}

function AnswerBlocks({ blocks }) {
  return (
    <s-stack gap="small-300">
      {blocks.map((block, index) => {
        if (block.type === "ordered") {
          return (
            <s-ordered-list key={`ordered-${index}`}>
              {block.items.map((item, itemIndex) => (
                <s-list-item key={`${item}-${itemIndex}`}>{item}</s-list-item>
              ))}
            </s-ordered-list>
          );
        }
        if (block.type === "unordered") {
          return (
            <s-unordered-list key={`unordered-${index}`}>
              {block.items.map((item, itemIndex) => (
                <s-list-item key={`${item}-${itemIndex}`}>{item}</s-list-item>
              ))}
            </s-unordered-list>
          );
        }
        return (
          <s-paragraph key={`paragraph-${index}`}>{block.text}</s-paragraph>
        );
      })}
    </s-stack>
  );
}

function AnswerSection({ heading, blocks, badge, badgeTone = "neutral" }) {
  return (
    <s-stack gap="small-300">
      <s-stack direction="inline" gap="small-300" alignItems="center">
        <s-heading>{heading}</s-heading>
        {badge && <s-badge tone={badgeTone}>{badge}</s-badge>}
      </s-stack>
      <AnswerBlocks blocks={blocks} />
    </s-stack>
  );
}

function AssistantAnswer({ content }) {
  const structured = parseStructuredAnswer(content);
  if (structured) {
    const listBlocks = (items, type = "unordered") => [{ type, items }];
    const urgencyBadge =
      structured.urgency === "stop"
        ? "Direct stoppen"
        : structured.urgency === "attention"
          ? "Let op"
          : "";
    const urgencyTone = structured.urgency === "stop" ? "critical" : "warning";

    return (
      <s-stack gap="base">
        <AnswerSection
          heading="Kort antwoord"
          blocks={[{ type: "paragraph", text: structured.summary }]}
          badge={urgencyBadge}
          badgeTone={urgencyTone}
        />

        {structured.safety.length > 0 && (
          <AnswerSection
            heading={
              structured.urgency === "stop" ? "Stop eerst" : "Eerst veilig"
            }
            blocks={listBlocks(structured.safety)}
          />
        )}

        {structured.causes.length > 0 && (
          <AnswerSection
            heading="Waarschijnlijke oorzaken"
            blocks={listBlocks(structured.causes)}
          />
        )}

        {structured.checks.length > 0 && (
          <AnswerSection
            heading="Nu controleren"
            blocks={listBlocks(structured.checks, "ordered")}
          />
        )}

        {structured.solution.length > 0 && (
          <AnswerSection
            heading="Oplossing"
            blocks={listBlocks(structured.solution, "ordered")}
          />
        )}

        {structured.followUp && (
          <AnswerSection
            heading="Nog één vraag"
            blocks={[{ type: "paragraph", text: structured.followUp }]}
          />
        )}
      </s-stack>
    );
  }

  const sections = parseAssistantAnswer(content);
  return (
    <s-stack gap="base">
      {sections.map((answerSection, index) => (
        <AnswerSection
          key={`${answerSection.heading}-${index}`}
          heading={answerSection.heading}
          blocks={answerSection.blocks}
        />
      ))}
    </s-stack>
  );
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
  const [usage, setUsage] = useState(null);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [questionImages, setQuestionImages] = useState([]);
  const [imageInputKey, setImageInputKey] = useState(0);
  const [imageError, setImageError] = useState("");

  function chooseQuestionImages(input) {
    const files = selectedFiles(input);
    if (!files.length) return;
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const next = [...questionImages];
    let error = "";

    for (const file of files) {
      if (!allowedTypes.has(file.type)) {
        error = "Gebruik alleen JPEG-, PNG- of WebP-foto's.";
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        error = "Iedere foto mag maximaal 5 MB zijn.";
        continue;
      }
      const duplicate = next.some(
        (item) =>
          item.name === file.name &&
          item.size === file.size &&
          item.lastModified === file.lastModified,
      );
      if (!duplicate) next.push(file);
    }
    if (next.length > 3) {
      error = "U kunt maximaal 3 foto's per vraag meesturen.";
      next.splice(3);
    }
    if (next.reduce((sum, file) => sum + file.size, 0) > 12 * 1024 * 1024) {
      error = "De foto's samen mogen maximaal 12 MB zijn.";
      return setImageError(error);
    }
    setQuestionImages(next);
    setImageError(error);
  }

  function removeQuestionImage(index) {
    setQuestionImages((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
    setImageError("");
    setImageInputKey((value) => value + 1);
  }

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
      const error = new Error(
        json.message || `Captain AI reageerde niet (status ${result.status}).`,
      );
      error.status = result.status;
      error.paymentRequired = Boolean(json.paymentRequired);
      error.usage = json.usage;
      throw error;
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
      setUsage(json.usage || null);
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
    setUsage(null);
    setCheckoutUrl("");
    setQuestionImages([]);
    setImageError("");
    setImageInputKey((value) => value + 1);
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
    const typedQuestion = question.trim();
    const selectedImages = questionImages;
    if ((!typedQuestion && !selectedImages.length) || busy) return;
    const value =
      typedQuestion ||
      "Kunt u deze foto beoordelen in de context van mijn bootprofiel?";
    setBusy(true);
    setNotice("");
    const localId = `local-${Date.now()}`;
    const localContent = selectedImages.length
      ? `${value}\n\n[${selectedImages.length} ${selectedImages.length === 1 ? "foto" : "foto's"} meegestuurd; afbeeldingen niet opgeslagen.]`
      : value;
    setMessages((old) => [
      ...old,
      { id: localId, role: "USER", content: localContent },
    ]);
    setQuestion("");
    try {
      const images = await Promise.all(
        selectedImages.map(async (file) => ({
          name: file.name,
          mimeType: file.type,
          data: await fileBase64(file),
        })),
      );
      const json = await request("POST", {
        intent: "ask",
        profileId,
        conversationId,
        message: value,
        images,
        improvementConsent: consent,
      });
      setConversationId(json.conversationId || conversationId);
      setMessages((old) => [...old, json.message]);
      setUsage(json.usage || usage);
      setQuestionImages([]);
      setImageError("");
      setImageInputKey((inputKey) => inputKey + 1);
    } catch (error) {
      setMessages((old) => old.filter((message) => message.id !== localId));
      setQuestion(value);
      setNotice(error.message);
      if (error.usage) setUsage(error.usage);
    } finally {
      setBusy(false);
    }
  }

  async function buyCredits() {
    if (!profileId || busy) return;
    setBusy(true);
    setNotice("");
    setCheckoutUrl("");
    try {
      const json = await request("POST", {
        intent: "create_credit_checkout",
        profileId,
      });
      setCheckoutUrl(json.checkoutUrl || "");
      setUsage(json.usage || usage);
      setNotice(
        "De veilige Shopify-betaling staat klaar. Na betaling wordt het tegoed automatisch toegevoegd.",
      );
    } catch (error) {
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
      setQuestionImages([]);
      setImageError("");
      setImageInputKey((value) => value + 1);
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
      setQuestionImages([]);
      setImageError("");
      setImageInputKey((value) => value + 1);
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
            <s-grid
              gridTemplateColumns="96px minmax(0, 1fr)"
              gap="base"
              alignItems="center"
            >
              <s-image
                src="https://bootprofielen.onrender.com/captain-ai.png"
                alt="Captain AI van WetterWinkel"
                aspectRatio="1/1"
              />
              <s-stack gap="small-300">
                <s-badge tone="info">Persoonlijk bootadvies</s-badge>
                <s-heading>Captain AI voor {boatName}</s-heading>
                <s-text>
                  Antwoorden op vragen over techniek, onderhoud en uitrusting,
                  afgestemd op uw boot en Digitaal serviceboek.
                </s-text>
              </s-stack>
            </s-grid>
            <s-banner heading="Captain AI is een hulpmiddel" tone="warning">
              Captain AI kan onvolledige of onjuiste informatie geven. Het
              advies vervangt geen fabrikantshandleiding, inspectie of deskundig
              oordeel. Controleer veiligheidskritische werkzaamheden altijd met
              de juiste handleiding en zo nodig een vakbedrijf. Aan antwoorden
              van Captain AI kunnen geen aanspraken of rechten worden ontleend.
            </s-banner>
            <s-text>
              Uw gesprekken worden veilig bij dit klantaccount en bootprofiel
              opgeslagen. U kunt een gesprek hieronder verwijderen.
            </s-text>

            {usage && (
              <s-box padding="base" border="base" borderRadius="base">
                <s-stack gap="small-300">
                  <s-heading>Captain AI-tegoed</s-heading>
                  <s-text>
                    Deze maand nog {usage.freeRemaining} gratis antwoord(en).
                    Extra tegoed: {usage.creditBalance} antwoord(en).
                  </s-text>
                  <s-text>
                    {usage.creditPackSize} extra antwoorden voor{" "}
                    {(usage.creditPackPriceCents / 100)
                      .toFixed(2)
                      .replace(".", ",")}{" "}
                    euro inclusief btw.
                  </s-text>
                  <s-button onClick={buyCredits} disabled={busy}>
                    Extra AI-antwoorden kopen
                  </s-button>
                  {checkoutUrl && (
                    <s-button
                      href={checkoutUrl}
                      target="_blank"
                      variant="primary"
                    >
                      Veilige Shopify-betaling openen
                    </s-button>
                  )}
                  <s-button
                    onClick={loadConversation}
                    disabled={busy || loading}
                  >
                    Tegoed na betaling vernieuwen
                  </s-button>
                </s-stack>
              </s-box>
            )}

            <s-checkbox
              label="Ik geef toestemming om mijn feedback en bijbehorende gespreksfragmenten gepseudonimiseerd te gebruiken om Captain AI gecontroleerd te verbeteren"
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
                  <s-stack direction="inline" gap="small-300">
                    <s-heading>
                      {message.role === "USER" ? "Uw vraag" : "Captain AI"}
                    </s-heading>
                    {message.role === "ASSISTANT" && (
                      <s-badge tone="info">Afgestemd op uw boot</s-badge>
                    )}
                  </s-stack>
                  {message.role === "ASSISTANT" ? (
                    <AssistantAnswer content={message.content} />
                  ) : (
                    <s-paragraph>{message.content}</s-paragraph>
                  )}

                  {(message.sources || []).length > 0 && (
                    <s-banner
                      heading={`Technische bronnen (${message.sources.length})`}
                      tone="neutral"
                      collapsible
                    >
                      <s-stack gap="small-300">
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
                    </s-banner>
                  )}

                  {(message.products || []).length > 0 && (
                    <s-section heading="Passend bij WetterWinkel">
                      <s-grid
                        gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))"
                        gap="small-300"
                      >
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
                      </s-grid>
                    </s-section>
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
            <s-drop-zone
              key={imageInputKey}
              multiple
              accept="image/jpeg,image/png,image/webp"
              label="Foto toevoegen aan uw vraag (maximaal 3)"
              error={imageError || undefined}
              disabled={busy}
              onInput={chooseQuestionImages}
              onChange={chooseQuestionImages}
            />
            {questionImages.length > 0 && (
              <s-stack gap="small-300">
                {questionImages.map((file, index) => (
                  <s-stack
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    direction="inline"
                    gap="small-300"
                    alignItems="center"
                  >
                    <s-text>{file.name}</s-text>
                    <s-button
                      onClick={() => removeQuestionImage(index)}
                      disabled={busy}
                      tone="critical"
                    >
                      Verwijderen
                    </s-button>
                  </s-stack>
                ))}
                <s-text>
                  Foto&apos;s worden alleen voor dit antwoord geanalyseerd en
                  niet in uw gesprek of bootprofiel opgeslagen.
                </s-text>
              </s-stack>
            )}
            <s-button
              onClick={ask}
              disabled={busy || (!question.trim() && !questionImages.length)}
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
