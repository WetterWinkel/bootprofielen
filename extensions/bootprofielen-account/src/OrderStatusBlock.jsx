import '@shopify/ui-extensions/preact';
import {render} from 'preact';

export default function extension() {
  render(<Extension />, document.body);
}

function Extension() {
  return (
    <s-stack gap="base">
      <s-heading>Mijn bootprofielen</s-heading>
      <s-text>🚤 Bootprofielen werkt!</s-text>
      <s-button>Nieuwe boot toevoegen</s-button>
    </s-stack>
  );
}
