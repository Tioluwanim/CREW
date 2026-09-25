import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { NotificationsMenu, AccountMenu } from './HeaderMenus';
import { amaraProfile } from '../../data/demoData';
import { demoNotifications } from '../../data/notifications';

const unreadCount = demoNotifications.filter((n) => !n.read).length;

describe('NotificationsMenu', () => {
  it('shows the unread count and opens the panel with every notification listed', () => {
    render(<NotificationsMenu />);

    const trigger = screen.getByRole('button', { name: new RegExp(`Notifications, ${unreadCount} unread`, 'i') });
    expect(within(trigger).getByText(String(unreadCount))).toBeInTheDocument();

    fireEvent.click(trigger);

    for (const notification of demoNotifications) {
      expect(screen.getByText(notification.title)).toBeInTheDocument();
    }
  });

  it('marks a single notification read on click, reducing the unread count', () => {
    render(<NotificationsMenu />);
    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }));

    const unread = demoNotifications.find((n) => !n.read)!;
    fireEvent.click(screen.getByText(unread.title));

    expect(screen.getByRole('button', { name: new RegExp(`Notifications, ${unreadCount - 1} unread`, 'i') })).toBeInTheDocument();
  });

  it('"Mark all read" clears the unread badge entirely', () => {
    render(<NotificationsMenu />);
    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }));
    fireEvent.click(screen.getByRole('button', { name: /Mark all read/i }));

    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('closes when Escape is pressed', () => {
    render(<NotificationsMenu />);
    const trigger = screen.getByRole('button', { name: /Notifications/i });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('AccountMenu', () => {
  it('shows the owner initial and opens to the business profile / settings / sign out links', () => {
    render(<AccountMenu />);

    const trigger = screen.getByRole('button', { name: 'Account menu' });
    expect(trigger).toHaveTextContent(amaraProfile.ownerName.charAt(0));

    fireEvent.click(trigger);

    expect(screen.getByText(amaraProfile.businessName)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Business profile/i })).toHaveAttribute('href', '/app/profile');
    expect(screen.getByRole('link', { name: /Settings/i })).toHaveAttribute('href', '/app/settings');
    expect(screen.getByRole('link', { name: /Sign out/i })).toHaveAttribute('href', '/');
  });
});
