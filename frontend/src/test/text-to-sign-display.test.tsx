import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TextToSignPanel } from '@/components/domain/TextToSignPanel';
import '@/i18n';

describe('Text-to-Sign Display Prototype', () => {
  it('renders initial empty state with welcoming invitation', () => {
    render(<TextToSignPanel currentLang="en" />);

    expect(screen.getByText(/Ready to translate/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Enter a phrase above or select an example below/i)
    ).toBeInTheDocument();
  });

  it('renders section title exactly as Text → Sign', () => {
    render(<TextToSignPanel currentLang="en" />);

    expect(screen.getByRole('heading', { level: 3, name: 'Text → Sign' })).toBeInTheDocument();
  });

  it('does not display the development notice in the rendered UI', () => {
    render(<TextToSignPanel currentLang="en" />);

    expect(screen.queryByText(/LSA translation is under development/i)).toBeNull();
    expect(
      screen.queryByText(/Only a limited number of words and phrases may be available/i)
    ).toBeNull();
  });

  it('renders "Try an example" section with candidate phrases and accurate badges', () => {
    render(<TextToSignPanel currentLang="en" />);

    expect(screen.getByText(/Try an example/i)).toBeInTheDocument();

    // Check candidate phrases
    expect(screen.getByText('Hello.')).toBeInTheDocument();
    expect(screen.getByText('Thank you.')).toBeInTheDocument();
    expect(screen.getByText('I need help.')).toBeInTheDocument();
    expect(screen.getByText('Where is the pharmacy?')).toBeInTheDocument();
    expect(screen.getByText('I need a doctor.')).toBeInTheDocument();

    // "Where is the pharmacy?" must be marked Planned
    const plannedBadges = screen.getAllByText(/Planned/i);
    expect(plannedBadges.length).toBeGreaterThanOrEqual(1);

    // Supported phrases have Supported badge
    const supportedBadges = screen.getAllByText(/Supported/i);
    expect(supportedBadges.length).toBeGreaterThanOrEqual(4);
  });

  it('clicking a supported example populates input and displays verified sign in the display box', async () => {
    render(<TextToSignPanel currentLang="en" />);

    const helloBtn = screen.getByText('Hello.');
    fireEvent.click(helloBtn);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('Hello.');

    await waitFor(() => {
      expect(screen.getByText('HELLO')).toBeInTheDocument();
    });

    // Confirms honest missing asset state rather than fake canvas gesture
    expect(screen.getByText(/Asset Pending Studio Recording/i)).toBeInTheDocument();
    expect(screen.getByText(/\/signs\/HELLO\.webm/i)).toBeInTheDocument();
  });

  it('clicking an unavailable candidate example displays the honest unsupported phrase state', async () => {
    render(<TextToSignPanel currentLang="en" />);

    const pharmacyBtn = screen.getByText('Where is the pharmacy?');
    fireEvent.click(pharmacyBtn);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('Where is the pharmacy?');

    await waitFor(() => {
      expect(screen.getByText(/LSA sign not currently available/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/This phrase is outside ConnectSign's current LSA vocabulary/i)
    ).toBeInTheDocument();
  });

  it('user can type a phrase and click Translate button', async () => {
    render(<TextToSignPanel currentLang="en" />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'I have a headache.' } });

    const translateBtn = screen.getByRole('button', { name: /Translate/i });
    fireEvent.click(translateBtn);

    await waitFor(() => {
      expect(screen.getByText('HEADACHE')).toBeInTheDocument();
    });
  });

  it('handles multi-sign sequence with previous and next navigation controls', async () => {
    render(<TextToSignPanel currentLang="en" />);

    const stomachBtn = screen.getByText('My stomach hurts.');
    fireEvent.click(stomachBtn);

    await waitFor(() => {
      expect(screen.getAllByText('STOMACH').length).toBeGreaterThanOrEqual(1);
    });

    // Check segment indicator
    expect(screen.getByText(/Sign 1 of 2/i)).toBeInTheDocument();

    // Click Next button to navigate to second segment
    const nextBtn = screen.getByRole('button', { name: /Next sign/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getAllByText('PAIN').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Sign 2 of 2/i)).toBeInTheDocument();
    });

    // Click Previous button to return to first segment
    const prevBtn = screen.getByRole('button', { name: /Previous sign/i });
    fireEvent.click(prevBtn);

    await waitFor(() => {
      expect(screen.getAllByText('STOMACH').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Sign 1 of 2/i)).toBeInTheDocument();
    });
  });

  it('invokes onAddToConversation callback when button clicked', async () => {
    const handleAdd = vi.fn();
    render(<TextToSignPanel currentLang="en" onAddToConversation={handleAdd} />);

    const helloBtn = screen.getByText('Hello.');
    fireEvent.click(helloBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add to conversation/i })).toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: /Add to conversation/i });
    fireEvent.click(addBtn);

    expect(handleAdd).toHaveBeenCalledWith('Hello.', ['HELLO']);
  });
});
