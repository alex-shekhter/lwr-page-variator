import { LightningElement, api } from 'lwc';

import { TOPICS, MESSAGE_FACTORY } from 'c/dynLoaderMessageHelper';
import { isInBuilderCheck, isAuraCheck } from 'c/dynLoadUtils';

/**
 * @slot Content-Region
 */
export default class DynComponentLoader extends LightningElement {
  @api title;
  @api loadingMode;
  @api loadingOrder; // integer 0 -> N   0 - first; N - last
  _pageAudience;
  @api get pageAudience() {
    return this._pageAudience;
  }
  set pageAudience(value) {
    this._pageAudience = value;
    this.sendMessage( 
      MESSAGE_FACTORY.DYN_CMP_PAGE_AUDIENCE_CHANGED( this ) 
    );
  }
  @api compAudience;
  @api description;

  _guid = crypto.randomUUID();
  @api get componentId() {
    return `DynComponentLoader_${this._guid}`;
  }

  // container component will set visibility state of component in production. 
  // It will be always visible inside the builder or controllable by the manager
  _showNow = false;
  @api get showNow() {
    return this._showNow;  
  }
  set showNow(value) {
    this._showNow = value;
  }

  @api isActive = false;

  isAura = isAuraCheck();
  isInBuilder = isInBuilderCheck();

  @api isDebug = false;
  get needShowInternalsStatus() {
    return this.isDebug || this.isInBuilder;
  }

  computeContainerClass() {
    let cls = "";
    if ( this.isInBuilder ) {
      cls = "container-designer-view";
      cls += " " + (this.isActive ? "active-container-designer-view" : "inactive-container-designer-view");
    }
    return cls;
  }

  computeCellClasses() {
    let cls = "grid-item";
    if ( this.isInBuilder ) {
      cls += " grid-item-inside-builder";
    }
    return cls;
  }

  isLmsHelperReady = false;
  isSlotWrapperReady = false;

  observer;

  renderedCallback() {
    if ( !this.isLmsHelperReady ) {
      this.isLmsHelperReady = this.sendMessage( MESSAGE_FACTORY.DYN_CMP_REGISTER(this) );
    }
    if ( this.loadingMode === "onvisible" && !this.isSlotWrapperReady ) {
      
      this.showNow = false;
      
      const slotWrapper = this.template.querySelector("div[data-slot-wrapper]");

      if ( slotWrapper ) {

        // Register observer if needed
        if ( !this.observer) {
          
          this.observer = new IntersectionObserver(this.onObserve.bind(this));
          
          this.observer.observe(slotWrapper);

          this.isSlotWrapperReady = true;
        }

      }
    }
  }

  // cleanup here
  disconnectedCallback() {
    // Somehow when we remove component from the Experience Builder disconnectedCallback
    // is not called it, but it is called when we change @api properties in the Editor,
    // In this case we will not use it
    //
    // TODO: file BUG
    //
    this.observer?.disconnect();
  }
  
  onObserve( entries, observer ) {
    entries.forEach(entry => {      
      if ( entry.isIntersecting ||  entry.intersectionRatio > 0) {
        this.sendMessage( MESSAGE_FACTORY.DYN_CMP_VISIBLE( this ) );
      }
    });
  }

  handleMessage(event) {
    const msg = event.detail;
    if ( msg.topic === TOPICS.DYN_CMP_CMD_SHOW ) {
      this.handleShowCommand(msg);
    }
    else if ( msg.topic === TOPICS.DYN_CMP_IS_AVAILABLE ) {
      this.handleIsAvailableRequest(msg);
    }
    else if ( msg.topic === TOPICS.DYN_CMP_BUILDER_CHG_VISIBILITY ) {
      this.handleBuilderChangeVisibilityRequest(msg);
    }
  }

  isMessageForMe(msg) {
    const target = msg.payload.targetCmp;
    let res = false;
    if ( Array.isArray(target) ) {
      res = target.includes(this.componentId);
    }
    else if ( target === "*" || target === this.componentId ) {
      res = true;
    }
    if ( res ) {
      this.exbTotalMessagesRecieved++;
    }
    return res;
  }

  handleShowCommand(msg) {
    if ( this.isMessageForMe(msg) ) {
      this.showNow = msg.payload.showNow;
      if ( this.loadingMode === "onvisible" && this.showNow ) {
        this.observer.disconnect();
        this.observer = undefined;
      }
    }
  }

  handleIsAvailableRequest(msg) {
    if ( this.isMessageForMe(msg) ) {
      if ( this.sendMessage( MESSAGE_FACTORY.DYN_CMP_REGISTER(this) ) ) {
        this.exbIsConnectedToLoadingManager = true;
      }
    }
  }

  handleBuilderChangeVisibilityRequest(msg) {
    if ( this.isMessageForMe(msg) ) {
      const slotWrapper = this.template.querySelector("div[data-slot-wrapper]");
      if ( slotWrapper ) {
        if ( msg.payload.showNow ) {
          slotWrapper.classList.remove("hide-from-builder");
        }
        else {
          slotWrapper.classList.add("hide-from-builder");
        }
      }
    }
  }

  sendMessage( message ) {
    const lmsHelper = this.template.querySelector("c-lms-pub-sub-helper");
    if ( lmsHelper ) {
      lmsHelper.sendMessage( message );
      this.exbTotalMessagesSent++;
    }
    return lmsHelper !== null && lmsHelper !== undefined;
  }

  /**
   * --- Experience Builder debug info related stuff
   */
  exbTotalMessagesSent = 0;
  exbTotalMessagesRecieved = 0;
  exbIsConnectedToLoadingManager = false;
}