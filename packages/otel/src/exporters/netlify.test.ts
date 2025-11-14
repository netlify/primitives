import { serializeSpans } from './netlify.ts'
import { SpanKind, SpanStatusCode, TraceFlags } from '@opentelemetry/api'
import { TraceState } from '@opentelemetry/core'
import { Resource } from '@opentelemetry/resources'
import { ReadableSpan } from '@opentelemetry/sdk-trace-node'
import { describe, test, expect } from 'vitest'

function createSpan(): ReadableSpan {
  return {
    name: 'span-name',
    kind: SpanKind.INTERNAL,
    spanContext: () => ({
      spanId: '0000000000000002',
      traceFlags: TraceFlags.SAMPLED,
      traceId: '00000000000000000000000000000001',
      isRemote: false,
      traceState: new TraceState('span=bar'),
    }),
    startTime: [1640715557, 342725388],
    endTime: [1640715558, 642725388],
    status: {
      code: SpanStatusCode.OK,
    },
    attributes: { 'string-attribute': 'some attribute value' },
    links: [
      {
        context: {
          spanId: '0000000000000003',
          traceId: '00000000000000000000000000000002',
          traceFlags: TraceFlags.SAMPLED,
          isRemote: false,
          traceState: new TraceState('link=foo'),
        },
        attributes: {
          'link-attribute': 'string value',
        },
      },
    ],
    events: [
      {
        name: 'event',
        time: [1640715558, 542725388],
        attributes: {
          'event-attribute': 'string value',
        },
      },
    ],
    duration: [1, 300000000],
    ended: true,
    resource: new Resource({
      'service.name': 'serviceName',
      'service.version': 'serviceVersion',
      'process.runtime.name': 'nodejs',
      'process.runtime.version': 'runtimeVersion',
      'deployment.environment': 'deploymentEnvironment',
      'http.url': 'siteUrl',
      'netlify.site.id': 'siteId',
      'netlify.site.name': 'siteName',
    }),
    instrumentationLibrary: {
      name: '@netlify/otel',
      version: '1.0.0',
    },
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
  }
}

describe('`serializeSpans`', () => {
  test('Returns expected results', () => {
    const sampleSpans = [createSpan()]
    const result = serializeSpans(sampleSpans)

    const expectedResult = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'serviceName' } },
              { key: 'service.version', value: { stringValue: 'serviceVersion' } },
              { key: 'process.runtime.name', value: { stringValue: 'nodejs' } },
              { key: 'process.runtime.version', value: { stringValue: 'runtimeVersion' } },
              { key: 'deployment.environment', value: { stringValue: 'deploymentEnvironment' } },
              { key: 'http.url', value: { stringValue: 'siteUrl' } },
              { key: 'netlify.site.id', value: { stringValue: 'siteId' } },
              { key: 'netlify.site.name', value: { stringValue: 'siteName' } },
            ],
            droppedAttributesCount: 0,
          },
          scopeSpans: [
            {
              scope: { name: '@netlify/otel', version: '1.0.0' },
              spans: [
                {
                  traceId: '00000000000000000000000000000001',
                  spanId: '0000000000000002',
                  name: 'span-name',
                  kind: 1,
                  startTimeUnixNano: '1640715557342725388',
                  endTimeUnixNano: '1640715558642725388',
                  attributes: [{ key: 'string-attribute', value: { stringValue: 'some attribute value' } }],
                  droppedAttributesCount: 0,
                  events: [
                    {
                      name: 'event',
                      timeUnixNano: '1640715558542725388',
                      attributes: [{ key: 'event-attribute', value: { stringValue: 'string value' } }],
                      droppedAttributesCount: 0,
                    },
                  ],
                  droppedEventsCount: 0,
                  status: { code: 1 },
                  links: [
                    {
                      spanId: '0000000000000003',
                      traceId: '00000000000000000000000000000002',
                      attributes: [{ key: 'link-attribute', value: { stringValue: 'string value' } }],
                      droppedAttributesCount: 0,
                    },
                  ],
                  droppedLinksCount: 0,
                },
              ],
            },
          ],
        },
      ],
    }

    expect(result).toEqual(expectedResult)
  })
})
