import { LightningElement, api, wire } from 'lwc';
import { 
  APPLICATION_SCOPE,
  MessageContext,
  publish, 
  subscribe, 
  unsubscribe 
} from 'lightning/messageService';

import UNI_CHANNEL from '@salesforce/messageChannel/UniversalTopicBasedChannel__c';

export default class LmsPubSubHelper extends LightningElement {
    @wire(MessageContext) messageContext;

    subscription = null;

    @api parentId;
    
    /**
     * On component connected to DOM, initialize subscription
     */
    connectedCallback() {
      this.subscribeToMessageChannel();
    }
    
    /**
     * On component disconnect, cleanup subscription
     */
    disconnectedCallback() {
        this.unsubscribeFromMessageChannel();
    }
    
    /**
     * Subscribe to the Lightning Message Channel
     */
    subscribeToMessageChannel() {
        if (!this.subscription) {
            this.subscription = subscribe(
                this.messageContext,
                UNI_CHANNEL,
                (message) => this.handleMessage(message),
                { scope: APPLICATION_SCOPE }
            );
        }
    }
    
    /**
     * Unsubscribe from the Lightning Message Channel
     */
    unsubscribeFromMessageChannel() {
        if (this.subscription) {
            unsubscribe(this.subscription);
            this.subscription = null;
        }
    }
    
    /**
     * Handle incoming messages and dispatch to parent
     * @param {Object} message - The message received from LMS
     */
    handleMessage(message) {
        // Forward the received message to the parent through a custom event
        const messageEvent = new CustomEvent('messagereceived', {
            detail: {
                topic: message.topic,
                payload: message.payload
            }
        });
        this.dispatchEvent(messageEvent);
    }
    
    /**
     * Public method to send a message through LMS
     * @param {Object} message - The arbitrary payload to send
     */
    @api
    sendMessage(message) {
        publish(this.messageContext, UNI_CHANNEL, message);
    }
}
