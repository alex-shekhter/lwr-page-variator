import { createElement } from 'lwc';
import DynComponentLoader from 'c/dynComponentLoader';
import LmsPubSubHelper from 'c/lmsPubSubHelper';
import { TOPICS, MESSAGE_FACTORY } from 'c/dynLoaderMessageHelper';

// Mock c/lmsPubSubHelper
jest.mock('c/lmsPubSubHelper', () => {
    return {
        default: jest.fn().mockImplementation(() => {
            return {
                sendMessage: jest.fn(),
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
            };
        })
    };
});

// Mock dynLoaderMessageHelper
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

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

describe('c-dyn-component-loader', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('sends DYN_CMP_REGISTER message on connectedCallback', () => {
        const element = createElement('c-dyn-component-loader', {
            is: DynComponentLoader
        });
        element.componentId = 'testCmpId';
        element.pageAudience = 'testPageAudience';
        element.compAudience = 'testCompAudience';
        element.loadingMode = 'onload';
        element.loadingOrder = 1;
        document.body.appendChild(element);

        const lmsHelperMock = LmsPubSubHelper.mock.instances[0];
        const sendMessageMock = lmsHelperMock.sendMessage;

        expect(sendMessageMock).toHaveBeenCalledWith({
            topic: TOPICS.DYN_CMP_REGISTER,
            payload: {
                cmpId: 'testCmpId',
                pageAudience: 'testPageAudience',
                compAudience: 'testCompAudience',
                loadMode: 'onload',
                loadingOrder: 1
            }
        });
    });

    it('sends DYN_CMP_VISIBLE message when component is visible and loadMode is onvisible', () => {
        const element = createElement('c-dyn-component-loader', {
            is: DynComponentLoader
        });
        element.componentId = 'testCmpId';
        element.pageAudience = 'testPageAudience';
        element.compAudience = 'testCompAudience';
        element.loadingMode = 'onvisible';
        element.loadingOrder = 1;
        document.body.appendChild(element);

        const lmsHelperMock = LmsPubSubHelper.mock.instances[0];
        const sendMessageMock = lmsHelperMock.sendMessage;

        element.isVisible = true;
        element.handleVisibilityChange();

        expect(sendMessageMock).toHaveBeenCalledWith({
            topic: TOPICS.DYN_CMP_VISIBLE,
            payload: {
                cmpId: 'testCmpId',
                pageAudience: 'testPageAudience',
                compAudience: 'testCompAudience',
                loadMode: 'onvisible',
                loadingOrder: 1
            }
        });
    });

    it('does not send DYN_CMP_VISIBLE message if component is not visible', () => {
        const element = createElement('c-dyn-component-loader', {
            is: DynComponentLoader
        });
        element.componentId = 'testCmpId';
        element.pageAudience = 'testPageAudience';
        element.compAudience = 'testCompAudience';
        element.loadingMode = 'onvisible';
        element.loadingOrder = 1;
        document.body.appendChild(element);

        const lmsHelperMock = LmsPubSubHelper.mock.instances[0];
        const sendMessageMock = lmsHelperMock.sendMessage;

        element.isVisible = false;
        element.handleVisibilityChange();

        expect(sendMessageMock).not.toHaveBeenCalled();
    });

    it('handles DYN_CMP_CMD_SHOW message and sets isComponentVisible to true', () => {
        const element = createElement('c-dyn-component-loader', {
            is: DynComponentLoader
        });
        element.componentId = 'testCmpId';
        document.body.appendChild(element);

        const lmsHelperMock = LmsPubSubHelper.mock.instances[0];
        const addEventListenerMock = lmsHelperMock.addEventListener;

        const callback = addEventListenerMock.mock.calls[0][1]; // Get the callback function

        // Simulate receiving a message
        callback({
            detail: {
                topic: TOPICS.DYN_CMP_CMD_SHOW,
                payload: {
                    targetCmp: 'testCmpId',
                    showNow: true
                }
            }
        });

        expect(element.isComponentVisible).toBe(true);
    });

    it('handles DYN_CMP_CMD_SHOW message with targetCmp = "*" and sets isComponentVisible to true', () => {
        const element = createElement('c-dyn-component-loader', {
            is: DynComponentLoader
        });
        element.componentId = 'testCmpId';
        document.body.appendChild(element);

        const lmsHelperMock = LmsPubSubHelper.mock.instances[0];
        const addEventListenerMock = lmsHelperMock.addEventListener;

        const callback = addEventListenerMock.mock.calls[0][1];

        callback({
            detail: {
                topic: TOPICS.DYN_CMP_CMD_SHOW,
                payload: {
                    targetCmp: '*',
                    showNow: true
                }
            }
        });

        expect(element.isComponentVisible).toBe(true);
    });

    it('handles DYN_CMP_CMD_SHOW message with targetCmp as an array and sets isComponentVisible to true if cmpId is in array', () => {
        const element = createElement('c-dyn-component-loader', {
            is: DynComponentLoader
        });
        element.componentId = 'testCmpId';
        document.body.appendChild(element);

        const lmsHelperMock = LmsPubSubHelper.mock.instances[0];
        const addEventListenerMock = lmsHelperMock.addEventListener;

        const callback = addEventListenerMock.mock.calls[0][1];

        callback({
            detail: {
                topic: TOPICS.DYN_CMP_CMD_SHOW,
                payload: {
                    targetCmp: ['testCmpId', 'otherCmpId'],
                    showNow: true
                }
            }
        });

        expect(element.isComponentVisible).toBe(true);
    });

    it('handles DYN_CMP_CMD_SHOW message and sets isComponentVisible to false', () => {
        const element = createElement('c-dyn-component-loader', {
            is: DynComponentLoader
        });
        element.componentId = 'testCmpId';
        document.body.appendChild(element);

        const lmsHelperMock = LmsPubSubHelper.mock.instances[0];
        const addEventListenerMock = lmsHelperMock.addEventListener;

        const callback = addEventListenerMock.mock.calls[0][1];

        callback({
            detail: {
                topic: TOPICS.DYN_CMP_CMD_SHOW,
                payload: {
                    targetCmp: 'testCmpId',
                    showNow: false
                }
            }
        });

        expect(element.isComponentVisible).toBe(false);
    });

    it('does not handle DYN_CMP_CMD_SHOW message if targetCmp does not match and is not "*" or in array', () => {
        const element = createElement('c-dyn-component-loader', {
            is: DynComponentLoader
        });
        element.componentId = 'testOtherCmpId';
        document.body.appendChild(element);

        const lmsHelperMock = LmsPubSubHelper.mock.instances[0];
        const addEventListenerMock = lmsHelperMock.addEventListener;

        const callback = addEventListenerMock.mock.calls[0][1];

        callback({
            detail: {
                topic: TOPICS.DYN_CMP_CMD_SHOW,
                payload: {
                    targetCmp: 'testCmpId',
                    showNow: true
                }
            }
        });

        expect(element.isComponentVisible).toBe(false);
    });

    it('sends DYN_CMP_PAGE_AUDIENCE_CHANGED message when pageAudience changes', () => {
        const element = createElement('c-dyn-component-loader', {
            is: DynComponentLoader
        });
        element.componentId = 'testCmpId';
        element.pageAudience = 'oldPageAudience';
        document.body.appendChild(element);

        const lmsHelperMock = LmsPubSubHelper.mock.instances[0];
        const sendMessageMock = lmsHelperMock.sendMessage;

        element.pageAudience = 'newPageAudience';
        element.handlePageAudienceChange();

        expect(sendMessageMock).toHaveBeenCalledWith({
            topic: TOPICS.DYN_CMP_PAGE_AUDIENCE_CHANGED,
            payload: {
                cmpId: 'testCmpId',
                pageAudience: 'newPageAudience'
            }
        });
    });

    it('removes the listener on disconnectedCallback', () => {
        const element = createElement('c-dyn-component-loader', {
            is: DynComponentLoader
        });
        document.body.appendChild(element);

        const lmsHelperMock = LmsPubSubHelper.mock.instances[0];
        const removeEventListenerMock = lmsHelperMock.removeEventListener;

        element.disconnectedCallback();

        expect(removeEventListenerMock).toHaveBeenCalled();
    });
});