import { xdr } from '@stellar/stellar-sdk';
import * as StellarSDK from '@stellar/stellar-sdk';
import { DiscordNotificationService } from './discord-notification';

const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('DiscordNotificationService', () => {
  const mockConfig = {
    webhookUrl: 'https://discord.com/api/webhooks/123/abc',
    webhookId: '123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createMockEvent(
    overrides: Partial<StellarSDK.rpc.Api.EventResponse> = {}
  ): StellarSDK.rpc.Api.EventResponse {
    return {
      id: 'event-123',
      type: 'contract',
      ledger: 1000,
      ledgerClosedAt: '2026-01-01T00:00:00Z',
      transactionIndex: 1,
      operationIndex: 0,
      inSuccessfulContractCall: true,
      txHash: 'abc123',
      topic: [xdr.ScVal.scvSymbol('autoshare_created')],
      value: xdr.ScVal.scvString('test value'),
      ...overrides,
    };
  }

  describe('sendEventNotification', () => {
    it('should send event notification successfully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const service = new DiscordNotificationService(mockConfig);
      const mockEvent = createMockEvent();
      const mockContractConfig = { address: 'CA123456789ABCDEF', events: ['autoshare_created'] };

      const result = await service.sendEventNotification(mockEvent, mockContractConfig);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(mockConfig.webhookUrl);
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
      const body = JSON.parse(options.body);
      expect(body.embeds).toHaveLength(1);
      expect(body.embeds[0].title).toContain('autoshare_created');
    });

    it('should handle webhook failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid payload'),
      });

      const service = new DiscordNotificationService(mockConfig);
      const mockEvent = createMockEvent();
      const mockContractConfig = { address: 'CA123', events: ['test'] };

      const result = await service.sendEventNotification(mockEvent, mockContractConfig);

      expect(result).toBe(false);
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const service = new DiscordNotificationService(mockConfig);
      const mockEvent = createMockEvent();
      const mockContractConfig = { address: 'CA123', events: ['test'] };

      const result = await service.sendEventNotification(mockEvent, mockContractConfig);

      expect(result).toBe(false);
    });
  });

  describe('sendTestMessage', () => {
    it('should send test message successfully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const service = new DiscordNotificationService(mockConfig);
      const result = await service.sendTestMessage();

      expect(result).toBe(true);
    });

    it('should handle test message failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const service = new DiscordNotificationService(mockConfig);
      const result = await service.sendTestMessage();

      expect(result).toBe(false);
    });
  });

  describe('formatEventMessage', () => {
    it('should format event with string value correctly', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const service = new DiscordNotificationService(mockConfig);
      const mockEvent = createMockEvent({
        value: xdr.ScVal.scvString('Hello World'),
      });
      const mockContractConfig = { address: 'CA123456789', events: ['test_event'] };

      const result = await service.sendEventNotification(mockEvent, mockContractConfig);

      expect(result).toBe(true);
      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      const valueField = body.embeds[0].fields.find((f: any) => f.name === 'Value');
      expect(valueField.value).toBe('Hello World');
    });

    it('should truncate long string values', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const service = new DiscordNotificationService(mockConfig);
      const longValue = 'a'.repeat(600);
      const mockEvent = createMockEvent({
        value: xdr.ScVal.scvString(longValue),
      });
      const mockContractConfig = { address: 'CA123', events: ['test'] };

      const result = await service.sendEventNotification(mockEvent, mockContractConfig);

      expect(result).toBe(true);
      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      const valueField = body.embeds[0].fields.find((f: any) => f.name === 'Value');
      expect(valueField.value.length).toBeLessThan(600);
      expect(valueField.value).toContain('...');
    });

    it('should handle symbol type values', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const service = new DiscordNotificationService(mockConfig);
      const mockEvent = createMockEvent({
        value: xdr.ScVal.scvSymbol('my_symbol'),
      });
      const mockContractConfig = { address: 'CA123', events: ['test'] };

      const result = await service.sendEventNotification(mockEvent, mockContractConfig);

      expect(result).toBe(true);
      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      const valueField = body.embeds[0].fields.find((f: any) => f.name === 'Value');
      expect(valueField.value).toContain('my_symbol');
    });
  });
});