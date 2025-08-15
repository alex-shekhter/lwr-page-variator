import { createElement } from 'lwc';
import DynLoadManager from 'c/dynLoadManager';
import LmsPubSubHelper from 'c/lmsPubSubHelper';
import { CurrentPageReference } from 'lightning/navigation';
import { getRecord } from 'lightning/uiRecordApi';
import getContextAndRulesByRecordId from '@salesforce/apex/AudienceContextController.getContextAndRulesByRecordId';
import getContextAndRulesByObjectApiName from '@salesforce/apex/AudienceContextController.getContextAndRulesByObjectApiName';
import getContextAndRulesByPageName from '@salesforce/apex/AudienceContextController.getContextAndRulesByPageName';
import { ConditionInterpreter } from 'c/audience_rules_interpreter';
import { TOPICS, MESSAGE_FACTORY } from 'c/dynLoaderMessageHelper';
import { isAuraCheck, isInBuilderCheck } from 'c/dynLoadUtils';

// Mock the wire adapter
jest.mock('lightning/navigation');
jest.mock('lightning/uiRecordApi');
jest.mock('@salesforce/apex/AudienceContextController.getContextAndRulesByRecordId', () => {
    return {
        default: jest.fn()
    };
});
jest.mock('@salesforce/apex/AudienceContextController.getContextAndRulesByObjectApiName', () => {
    return {
        default: jest.fn()
    };
});
jest.mock('@salesforce/apex/AudienceContextController.getContextAndRulesByPageName', () => {
    return {
        default: jest.fn()
    };
});

// Mock lmsPubSubHelper
jest.mock('c/lmsPubSubHelper', () => {
    return {
        default: jest.fn().mockImplementation(() => {
            return {
                sendMessage: jest.fn(),
                addEventListener: jest.fn(), // Mock addEventListener
                removeEventListener: jest.fn(), // Mock removeEventListener
            };
        })
    };
});

// Mock dynLoadUtils
jest.mock('c/dynLoadUtils', () => {
    return {
        isAuraCheck: jest.fn(),
        isInBuilderCheck: jest.fn()
    };
});

// Mock dynLoaderMessageHelper (optional, but good practice)
jest.mock('c/dynLoaderMessageHelper', () => {
    return {
        TOPICS: {
            DYN_CMP_REGISTER: 'DYN_CMP_REGISTER',
            DYN_CMP_VISIBLE: 'DYN_CMP_VISIBLE',
            DYN_CMP_IS_AVAILABLE: 'DYN_CMP_IS_AVAILABLE',
            DYN_CMP_CMD_SHOW: 'DYN_CMP_CMD_SHOW',
            DYN_CMP_BUILDER_CHG_VISIBILITY: 'DYN_CMP_BUILDER_CHG_VISIBILITY',
            DYN_CMP_PAGE_AUDIENCE_CHANGED: 'DYN_CMP_PAGE_AUDIENCE_CHANGED',
            DYN_CMP_REMOVED_FROM_BUILDER: 'DYN_CMP_REMOVED_FROM_BUILDER'
        },
        MESSAGE_FACTORY: {
            DYN_CMP_REGISTER: jest.fn(payload => ({ topic: 'DYN_CMP_REGISTER', payload })),
            DYN_CMP_VISIBLE: jest.fn(payload => ({ topic: 'DYN_CMP_VISIBLE', payload })),
            DYN_CMP_IS_AVAILABLE: jest.fn(payload => ({ topic: 'DYN_CMP_IS_AVAILABLE', payload: { targetCmp: payload } })),
            DYN_CMP_CMD_SHOW: jest.fn((targetCmp, showNow) => ({ topic: 'DYN_CMP_CMD_SHOW', payload: { targetCmp, showNow } })),
            DYN_CMP_BUILDER_CHG_VISIBILITY: jest.fn((targetCmp, showNow) => ({ topic: 'DYN_CMP_BUILDER_CHG_VISIBILITY', payload: { targetCmp, showNow } })),
            DYN_CMP_PAGE_AUDIENCE_CHANGED: jest.fn(payload => ({ topic: 'DYN_CMP_PAGE_AUDIENCE_CHANGED', payload })),
            DYN_CMP_REMOVED_FROM_BUILDER: jest.fn(payload => ({ topic: 'DYN_CMP_REMOVED_FROM_BUILDER', payload })),
        }
    };
});

// Helper function to flush promises (for wire)
const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

describe('c-dyn-load-manager', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('renders the component for LWR', () => {
        isAuraCheck.mockReturnValue(false);
        const element = createElement('c-dyn-load-manager', {
            is: DynLoadManager
        });
        document.body.appendChild(element);
        expect(element.shadowRoot.textContent).not.toContain('Component is only for LWR sites, not Aura');
    });

    it('does not render for Aura', () => {
        isAuraCheck.mockReturnValue(true);
        const element = createElement('c-dyn-load-manager', {
            is: DynLoadManager
        });
        document.body.appendChild(element);
        return flushPromises().then(() => {
            expect(element.shadowRoot.textContent).toContain('Component is only for LWR sites, not Aura');
        });
    });

    it('wires CurrentPageReference and calls the appropriate Apex method for standard__objectPage', async () => {
        const element = createElement('c-dyn-load-manager', {
            is: DynLoadManager
        });
        document.body.appendChild(element);

        // Mock CurrentPageReference
        CurrentPageReference.mockReturnValue({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: 'TestObject'
            },
            state: {}
        });

        // Wait for the wire to resolve
        await flushPromises();

        expect(getContextAndRulesByObjectApiName).toHaveBeenCalledWith({
            objectApiName: 'TestObject'
        });
    });

    it('wires CurrentPageReference and calls the appropriate Apex method for comm__namedPage', async () => {
        const element = createElement('c-dyn-load-manager', {
            is: DynLoadManager
        });
        document.body.appendChild(element);

        // Mock CurrentPageReference
        CurrentPageReference.mockReturnValue({
            type: 'comm__namedPage',
            attributes: {
                name: 'HomePage'
            },
            state: {}
        });

        // Wait for the wire to resolve
        await flushPromises();

        expect(getContextAndRulesByPageName).toHaveBeenCalledWith({
            pageName: 'HomePage'
        });
    });

    it('wires CurrentPageReference and calls the appropriate Apex method for standard__recordPage', async () => {
        const element = createElement('c-dyn-load-manager', {
            is: DynLoadManager
        });
        document.body.appendChild(element);

        // Mock CurrentPageReference
        CurrentPageReference.mockReturnValue({
            type: 'standard__recordPage',
            attributes: {
                objectApiName: 'TestObject',
                recordId: 'testRecordId',
                actionName: 'view'
            },
            state: {}
        });

        // Wait for the wire to resolve
        await flushPromises();

        expect(getContextAndRulesByRecordId).toHaveBeenCalledWith({
            recordId: 'testRecordId'
        });
        expect(element.recordId).toBe('testRecordId');
    });

    it('handles getContextAndRulesByRecordId success', async () => {
        const element = createElement('c-dyn-load-manager', {
            is: DynLoadManager
        });
        document.body.appendChild(element);

        // Mock CurrentPageReference and getContextAndRulesByRecordId
        CurrentPageReference.mockReturnValue({
            type: 'standard__recordPage',
            attributes: {
                objectApiName: 'TestObject',
                recordId: 'testRecordId',
                actionName: 'view'
            },
            state: {}
        });
        const mockData = {
            context: {
                profile: 'Test Profile',
                permissions: ['Permission1'],
                role: 'Test Role',
                location: { country: 'Test Country' },
                dataBySObjectType: {}
            },
            rules: [],
            rulesWithPriority: []
        };
        getContextAndRulesByRecordId.mockResolvedValue(mockData);

        await flushPromises();

        expect(element.shadowRoot.textContent).not.toContain('error');
        expect(element.audienceContextAndRules).toBeDefined();
    });

    it('handles getContextAndRulesByRecordId error', async () => {
        const element = createElement('c-dyn-load-manager', {
            is: DynLoadManager
        });
        document.body.appendChild(element);

        // Mock CurrentPageReference and getContextAndRulesByRecordId
        CurrentPageReference.mockReturnValue({
            type: 'standard__recordPage',
            attributes: {
                objectApiName: 'TestObject',
                recordId: 'testRecordId',
                actionName: 'view'
            },
            state: {}
        });
        getContextAndRulesByRecordId.mockRejectedValue(new Error('Apex Error'));

        await flushPromises();

        expect(element.shadowRoot.textContent).toContain('error');
        expect(element.audienceContextAndRules).toBeUndefined();
    });

    it('registers a component', () => {
        const element = createElement('c-dyn-load-manager', {
            is: DynLoadManager
        });
        document.body.appendChild(element);

        const mockComponentData = {
            cmpId: 'cmp1',
            pageAudience: 'audience1',
            compAudience: 'audience2',
            loadMode: 'onload',
            loadingOrder: 1
        };

        const lmsHelperMock = LmsPubSubHelper.mock.instances[0];

        lmsHelperMock.dispatchEvent(new CustomEvent('messagereceived', {
            detail: {
                topic: 'DYN_CMP_REGISTER',
                payload: mockComponentData
            }
        }));

        expect(element.componentsById.get('cmp1')).toEqual(mockComponentData);
        expect(element.componentsByPageAudience.get('audience1')).toEqual([mockComponentData]);
        expect(element.componentsByCmpAudience.get('audience2')).toEqual([mockComponentData]);
        expect(element.componentsByLoadType.get('onload')).toEqual([mockComponentData]);
    });

    it('removes a component', () => {
        const element = createElement('c-dyn-load-manager', {
            is: DynLoadManager
        });
        document.body.appendChild(element);

        const mockComponentData = {
            cmpId: 'cmp1',
            pageAudience: 'audience1',
            compAudience: 'audience2',
            loadMode: 'onload',
            loadingOrder: 1
        };
        element.componentsById.set('cmp1', mockComponentData);
        element.componentsByPageAudience.set('audience1', [mockComponentData]);
        element.componentsByCmpAudience.set('audience2', [mockComponentData]);
        element.componentsByLoadType.set('onload', [mockComponentData]);

        const lmsHelperMock = LmsPubSubHelper.mock.instances[0];

        lmsHelperMock.dispatchEvent(new CustomEvent('messagereceived', {
            detail: {
                topic: 'DYN_CMP_REMOVED_FROM_BUILDER',
                payload: { cmpId: 'cmp1' }
            }
        }));

        expect(element.componentsById.has('cmp1')).toBe(false);
        expect(element.componentsByPageAudience.get('audience1')).toBeUndefined();
        expect(element.componentsByCmpAudience.get('audience2')).toBeUndefined();
        expect(element.componentsByLoadType.get('onload')).toBeUndefined();
    });

    it('sends a message', () => {
        const element = createElement('c-dyn-load-manager', {
            is: DynLoadManager
        });
        document.body.appendChild(element);

        const lmsHelperMock = LmsPubSubHelper.mock.instances[0];
        const sendMessageMock = lmsHelperMock.sendMessage;

        const msg = { topic: 'TEST', payload: {} };
        element.sendMessage(msg);

        expect(sendMessageMock).toHaveBeenCalledWith(msg);
        expect(element.exbTotalMessagesSent).toBe(1);
    });

    it('handles page audience view change', () => {
        const element = createElement('c-dyn-load-manager', {
            is: DynLoadManager
        });
        document.body.appendChild(element);

        const lmsHelperMock = LmsPubSubHelper.mock.instances[0];
        const sendMessageMock = lmsHelperMock.sendMessage;

        element.selectedPageAudience = 'oldAudience';
        element.handlePageAudiencesViewChange({ detail: { value: 'newAudience' } });

        expect(sendMessageMock).toHaveBeenCalledTimes(2);
        expect(element.selectedPageAudience).toBe('newAudience');
    });

    it('checks component audiences and returns cmpIds to show', () => {
        const element = createElement('c-dyn-load-manager', {
            is: DynLoadManager
        });
        document.body.appendChild(element);

        // Mock components and context
        element.componentsById = new Map([
            ['cmp1', { cmpId: 'cmp1', pageAudience: 'pageAud1', compAudience: 'compAud1' }],
            ['cmp2', { cmpId: 'cmp2', pageAudience: 'pageAud2', compAudience: 'compAud2' }],
            ['cmp3', { cmpId: 'cmp3', pageAudience: 'pageAud1', compAudience: 'compAud3' }]
        ]);
        element.audienceContextAndRules = {
            AudiencesByName: new Map([
                ['compAud1', 'true'],
                ['compAud2', 'false'],
                ['compAud3', 'true']
            ])
        };
        element.interpreter = {
            evaluate: jest.fn(rule => rule === 'true')
        };
        element.targetAudience = 'pageAud1';

        const cmpIdsToCheck = ['cmp1', 'cmp2', 'cmp3'];
        const cmpIdsToShow = element.checkComponentAudiences(cmpIdsToCheck);

        expect(cmpIdsToShow).toEqual(['cmp1', 'cmp3']);
    });

    it('sends DYN_CMP_IS_AVAILABLE on renderedCallback', () => {
        const element = createElement('c-dyn-load-manager', {
            is: DynLoadManager
        });
        document.body.appendChild(element);

        const lmsHelperMock = LmsPubSubHelper.mock.instances[0];
        const sendMessageMock = lmsHelperMock.sendMessage;

        return flushPromises().then(() => {
            expect(sendMessageMock).toHaveBeenCalledWith({
                topic: TOPICS.DYN_CMP_IS_AVAILABLE,
                payload: {
                    targetCmp: '*'
                }
            });
        });
    });
});