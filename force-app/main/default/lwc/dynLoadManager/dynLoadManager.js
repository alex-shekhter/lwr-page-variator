import { LightningElement, api, wire, track } from 'lwc';

import { CurrentPageReference } from "lightning/navigation";

import { isAuraCheck, isInBuilderCheck } from 'c/dynLoadUtils';
import { TOPICS, MESSAGE_FACTORY } from 'c/dynLoaderMessageHelper';
import getContextAndRulesByRecordId from '@salesforce/apex/AudienceContextController.getContextAndRulesByRecordId';
import getContextAndRulesByObjectApiName from '@salesforce/apex/AudienceContextController.getContextAndRulesByObjectApiName';
import getContextAndRulesByPageName from '@salesforce/apex/AudienceContextController.getContextAndRulesByPageName';
import { ConditionInterpreter } from './audience_rules_interpreter';

const VIEW_ALL_OPT = "-- All --";
const VIEW_TARGET_PAGE_AUDIENCE_OPT = "-- Target Page Audience --";

const DEFAULT_PAGE_VISIBILITY_OPTS = [
   { label: VIEW_ALL_OPT, value: VIEW_ALL_OPT },
   { label: VIEW_TARGET_PAGE_AUDIENCE_OPT, value: VIEW_TARGET_PAGE_AUDIENCE_OPT },
];
export default class DynLoadManager extends LightningElement {
  @api recordId;
  @api objectApiName;

  /**
   * We would like to minimize recalculation of the context so we use URI change 1 time only
   */
  _currentUri = "";
  @wire(CurrentPageReference)
  getPageReferenceParameters(currentPageReference) {
    if (currentPageReference && this._currentUri !== window.location.href ) {
      this._currentUri = window.location.href;
      /**
       * 
       * {
          "type": "standard__objectPage",
          "attributes": {
            "objectApiName": "SalesPlayTemplate__c",
            "actionName": "home"
          },
          "state": {
            "filterName": "Default"
          }
        }

        {
          "type": "standard__recordPage",
          "attributes": {
            "objectApiName": "Opportunity",
            "recordId": "0065900000LMfdbAAD",
            "actionName": "view"
          },
          "state": {
            "recordName": "partneruserchannelledopportunitygc"
          }
        }

        {
          "type": "comm__namedPage",
          "attributes": {
            "name": "Home"
          },
          "state": {}
        }
       * 
       */
      console.debug(
        `--->>> DynLoadManager::getPageReferenceParameters recordId=${this._recordId}`, 
        "currentPageReference", currentPageReference 
      );
      if ( currentPageReference.type === "standard__objectPage" ) {
        getContextAndRulesByObjectApiName({
          objectApiName: currentPageReference.attributes.objectApiName
        }).then(data => {
          this.initContextFromServer( data );
          this.error = undefined;
        })
        .catch(error => {
          console.error(
            `--->>> DynLoadManager::getPageReferenceParameters: standard__objectPage error: `, 
            error 
          );
          this.error = error;
          this.audienceContextAndRules = undefined;
        });
      }
      else if ( currentPageReference.type === "comm__namedPage" ) {
        getContextAndRulesByPageName({
          pageName: currentPageReference.attributes.name
        }).then(data => {
          this.initContextFromServer( data );
          this.error = undefined;
        }).catch(error => {
          console.error(
            `--->>> DynLoadManager::getPageReferenceParameters: comm__namedPage error: `, error 
          );
          this.error = error;
          this.audienceContextAndRules = undefined;
        });
      }
      else if ( currentPageReference.type === "standard__recordPage" ) {
        this.recordId = currentPageReference.attributes.recordId;
        getContextAndRulesByRecordId({
          recordId: this.recordId
        }).then(data => {
          this.initContextFromServer( data );
          this.error = undefined;
        }).catch( error => {
          console.error(
            `--->>> DynLoadManager::getPageReferenceParameters: standard__recordPage error: `, error 
          );
          this.error = error;
          this.audienceContextAndRules = undefined;
        });
      }
      else {
        throw new Error( 
          `--->>> DynLoadManager::getPageReferenceParameters: unsupported page reference type: ${currentPageReference.type}` 
        );
      }
    }
  }

  _settings;
  @api get settings() {
    return JSON.stringify( Array.from( this.componentsByPageAudience.keys() ) );
  }
  set settings(value) {
    const showTargetAudience = "--- Target Audience ---";
    const showAllAudiences = "--- All Audiences ---";
    this._settings = undefined;
  }

  isAura = isAuraCheck();

  isInBuilder = isInBuilderCheck();

  _guid = crypto.randomUUID();
  @api get componentId() {
    return `DynLoadManager_${this._guid}`;
  }

  // Inside builder we will not have a recordId for the Home page for example. But we still need to render components
  @api isNoRecordExpected = false;

  componentsById = new Map();
  componentsByPageAudience = new Map();
  componentsByCmpAudience = new Map();
  componentsByLoadType = new Map(); 

  get numberOfRegisteredComponents() {
    return this.componentsById.size;
  }

  get numberOfRegisteredPages() {
    return this.componentsByPageAudience.size;
  }

  exbTotalMessagesRecieved = 0;
  exbTotalMessagesSent = 0;

  @api isDebug = false;
  get needShowInternalsStatus() {
    return this.isDebug || this.isInBuilder;
  }

  @track audienceContextAndRules;
  @track audienceRulesPriorities;

  // Cached already evaluated Audience rules to speedup processing... 
  checkedAudiences = {};

  targetAudience;

  // To hide/show components in the builder
  selectedPageAudience = VIEW_ALL_OPT;
  // combobox options to conditionally show/hide registered page audiences 
  registeredPageAudiences = DEFAULT_PAGE_VISIBILITY_OPTS; 

  interpreter;
  
  initContextFromServer( data ) {
      // TODO: conversion logic belongs to the Interpreter not here... Move...
      this.audienceContextAndRules = this.convertServerSideAudienceContextAndRulesToClientSide( data );
      
      this.audienceRulesPriorities = (
        data.rulesWithPriority 
        && Array.isArray(data.rulesWithPriority) 
        && data.rulesWithPriority.length > 0
      ) ? [...data.rulesWithPriority] : [];
      this.audienceRulesPriorities.sort((a,b) => a.audienceRulePriority - b.audienceRulePriority);

      console.debug( `--->>> DynLoadManager::initContextFromServer: audienceRulesPriorities: `, JSON.stringify( this.audienceRulesPriorities ) );
      console.debug(`--->>> DynLoadManager::initContextFromServer: audienceContextAndRules: `, JSON.stringify( this.audienceContextAndRules ));
      
      this.checkedAudiences = {};

      this.interpreter = new ConditionInterpreter( this.audienceContextAndRules );

      // in case if page is not fully relaoded, but object/record or url has been changed
      // we can have previously visible components.
      this.hideAllDynLoaderComponents(); 
  
      this.findPageAudience();

      this.processAlreadyRegisteredComponents();
  }

  processAlreadyRegisteredComponents() {
    // if ( this.isInBuilder ) {
    //   return;
    // }

    const cmpsToShow = this.checkComponentAudiences( Array.from( this.componentsById.keys() ) );
    console.debug( `--->>> DynLoadManager::processAlreadyRegisteredComponents: cmpsToShow: `, JSON.stringify( cmpsToShow ) );
    if ( !cmpsToShow || cmpsToShow.length === 0 ) {
      console.error( `--->>> DynLoadManager::processAlreadyRegisteredComponents: no components to show:`, this.componentsById );
    }
    else {
      this.sendMessage( MESSAGE_FACTORY.DYN_CMP_CMD_SHOW( cmpsToShow, true ) );
    }
  }

  convertServerSideAudienceContextAndRulesToClientSide(data) {
    const res = {
      Profile: data.context.profile,
      Permission: (data.context.permissions && Array.isArray(data.context.permissions)) ? new Set( data.context.permissions) : new Set(),
      Role: data.context.role,
      Country: data.context.location?.country, 
      State: data.context.location?.state, 
      City: data.context.location?.city, 
      Domain: "",
      AudiencesByName: new Map(data.rules?.map(rule => [rule.audienceId, rule.audienceRule])),
      Data: dataBySObjectTypeToMap( data.context.dataBySObjectType )
    };
      
    return res;
  }

  _isLmsHelperReady = false;
  renderedCallback() {
    if ( !this._isLmsHelperReady ) {
      this._isLmsHelperReady = this.sendMessage( MESSAGE_FACTORY.DYN_CMP_IS_AVAILABLE( "*" ) );
    }
  }

  sendMessage( msg ) {
    const lmsHelper = this.template.querySelector("c-lms-pub-sub-helper");
    if ( lmsHelper ) {
      lmsHelper.sendMessage( msg );
      this.exbTotalMessagesSent++;
    }
    return lmsHelper !== null && lmsHelper !== undefined;
  }

  handleMessage(event) {
    const msg = event.detail;
    if ( msg.topic === TOPICS.DYN_CMP_REGISTER ) {
      this.registerComponent( msg );
    }
    else if ( msg.topic === TOPICS.DYN_CMP_VISIBLE ) {
      this.handleVisibleCommand( msg );
    }
    else if ( msg.topic === TOPICS.DYN_CMP_REMOVED_FROM_BUILDER ) {
      this.handleRemovedFromBuilderCommand( msg );
    }
  }
    
  /**
   * 
   *  {
   *     cmpId: dynCmpLoaderInstance.componentId,
   *     pageAudience: dynCmpLoaderInstance.pageAudience,
   *     compAudience: dynCmpLoaderInstance.compAudience,
   *     loadMode: dynCmpLoaderInstance.loadingMode,
   *     loadingOrder: dynCmpLoaderInstance.loadingOrder
   *   }
   *
   * 
   * @param {*} componentData 
   */
  addComponent( componentData ) {
    this.componentsById.set( componentData.cmpId, componentData );

    const add2map = (key, value, map) => {
      let valuesArr = map.get( key );
      if ( !valuesArr ) {
        valuesArr = [ value ];
        map.set( key, valuesArr );
      }
      else {
        const cmpIdx = valuesArr.findIndex( cmp => cmp.cmpId === value.cmpId );
        if ( cmpIdx > -1 ) {
          valuesArr.splice( cmpIdx, 1 );
        }
        valuesArr.push( value );
      }

      return valuesArr;
    }

    add2map( componentData.pageAudience, componentData, this.componentsByPageAudience );
    if ( componentData.compAudience ) {
      add2map( componentData.compAudience, componentData, this.componentsByCmpAudience ); 
    }

    const cmps = add2map( componentData.loadType, componentData, this.componentsByLoadType );
    cmps.sort(( a, b ) => a.loadingOrder - b.loadingOrder);

    this.registeredPageAudiences = [
      ...DEFAULT_PAGE_VISIBILITY_OPTS,
      ...(Array.from(this.componentsByPageAudience.keys()).map(a=>({ label: a, value: a })))
    ];
  }

  registerComponent( msg ) {
    this.exbTotalMessagesRecieved++;
    this.addComponent( msg.payload );
    // TODO: naive simple implementation without loadorder
    const cmp = this.componentsById.get( msg.payload.cmpId );
    if ( cmp && cmp.loadMode === "onload"  ) {
      const res = this.checkAudience( msg );
      if ( res.show ) {
        // this.sendMessage( MESSAGE_FACTORY.DYN_CMP_CMD_SHOW( msg.payload.cmpId, true ) );
        this.sendMessage( MESSAGE_FACTORY.DYN_CMP_CMD_SHOW( res.cmpIds, res.show ) );
      }
    } 
  }

  handleVisibleCommand( msg ) {
    this.exbTotalMessagesRecieved++;
    this.addComponent( msg.payload );
    // TODO: naive simple implementation without load order
    const cmp = this.componentsById.get( msg.payload.cmpId );
    if ( cmp && cmp.loadMode === "onvisible" ) {
      const res = this.checkAudience( msg );
      if ( res.show ) {
        // this.sendMessage( MESSAGE_FACTORY.DYN_CMP_CMD_SHOW( msg.payload.cmpId, true ) );
        this.sendMessage( MESSAGE_FACTORY.DYN_CMP_CMD_SHOW( res.cmpIds, true ) );
      }
    } 
  }

  removeComponent( cmpId ) {
    const rmCmpFromMap = (map, key, cmpId) => {
      const cmpList = map.get( key );
      if ( cmpList ) {
        const cmpIdx = cmpList.findIndex( cmp => cmp.cmpId === cmpId );
        if ( cmpIdx > -1 ) {
          cmpList.splice( cmpIdx, 1 );
        }
      }
      return map;
    };
    
    const trgCmp = this.componentsById.get( cmpId );
    if ( trgCmp ) {
      this.componentsById.delete( cmpId );
      rmCmpFromMap( this.componentsByLoadType, trgCmp.loadMode, cmpId );
      rmCmpFromMap( this.componentsByPageAudience, trgCmp.pageAudience, cmpId );
      rmCmpFromMap( this.componentsByCmpAudience, trgCmp.compAudience, cmpId );
    }
  }

  handleRemovedFromBuilderCommand( msg ) {
    this.exbTotalMessagesRecieved++;
    this.removeComponent( msg.payload.cmpId );
  }

  hideAllDynLoaderComponents() {
    this.sendMessage( MESSAGE_FACTORY.DYN_CMP_CMD_SHOW( "*", false ) );
  }

  findPageAudience() {
    if ( !this.audienceRulesPriorities ) {
      return;
    }

    console.debug(`--->>> DynLoadManager::findPageAudience: context: `, 
      JSON.stringify( 
        consoleDebugContext( 'findPageAudience', this.audienceContextAndRules ) 
      ) 
    );

    console.debug( `--->>> DynLoadManager::findPageAudience: audienceRulesPriorities: `, 
      JSON.stringify( this.audienceRulesPriorities, null, 2 )
    );

    for ( const audPriority of this.audienceRulesPriorities ) {

      if ( this.checkedAudiences[ audPriority.audienceId ] && this.checkedAudiences[ audPriority.audienceId ].result ) {
        if ( this.checkedAudiences[ audPriority.audienceId ].result ) {
          this.targetAudience = audPriority.audienceId;
          break;
        }
        else {
          continue;
        }
      }

      console.info( `--->>> DynLoadManager::findPageAudience: CHECKING  audienceId: `, audPriority.audienceId );
      // Check that this rule satisfies 
      const rule = this.audienceContextAndRules.AudiencesByName.get( audPriority.audienceId );
      if (  !rule ) {
        console.error( `--->>> DynLoadManager::findPageAudience: audienceId=${audPriority.audienceId}: RULE is empty! skipping... `);
        continue;
      } 
      const evalRes = this.interpreter.evaluate( rule );
      if ( evalRes ) {
        console.info( `--->>> DynLoadManager::findPageAudience: audience ${audPriority.audienceId} -> ${rule} Is GOOD`);
        this.targetAudience = audPriority.audienceId;
        break;
      }
      else {
        console.info( `--->>> DynLoadManager::findPageAudience: audience ${audPriority.audienceId} -> ${rule} not satisfied`);
      }
      this.checkedAudiences[ audPriority.audienceId ] = { result: evalRes };
    }
  }

  checkAudience( msg ) {
    let res = {
        show: false,
        cmpIds: []
    };

    if ( !this.targetAudience ) {
      this.findPageAudience();
    }

    // All audiences are valid
    if ( this.isInBuilder /*&& this.isNoRecordExpected*/ ) {
      return {
        show: true,
        cmpIds: [msg.payload.cmpId]
      };
    }

    if ( !this.isInBuilder && this.targetAudience ) {
      const cmpsToShow = this.checkComponentAudiences( [msg.payload.cmpId ] );
      if ( cmpsToShow.length > 0 ) {
        return {
            show: true,
            cmpIds: cmpsToShow
        };
      } 
        
    } 

    return res;
  }

  checkAudienceRules( audienceId ) {
    if ( !audienceId || audienceId === '--NONE--' ) {
      console.debug( `--->>> DynLoadManager::checkAudienceRules: Component audienceId=${audienceId}; is empty... Result TRUE`);
      return true; // means is good for everybody
    }
    if ( this.checkedAudiences[ audienceId ] && this.checkedAudiences[ audienceId ].result) {
      console.debug( `--->>> DynLoadManager::checkAudienceRules: Component audienceId=${audienceId}; is cached... Result: ${this.checkedAudiences[ audienceId ].result}`);
      return this.checkedAudiences[ audienceId ].result; 
    }
    else {
      const rule = this.audienceContextAndRules.AudiencesByName.get( audienceId );
      const res = this.interpreter.evaluate( rule );
      this.checkedAudiences[ audienceId ] = { result: res };
      console.debug(
        `--->>> DynLoadManager::checkAudienceRules: Component audienceId=${audienceId}  checking rule: `, 
        rule, 
        "Result:", res 
      );
      return res;       
    }
  }

  checkPageAudience( cmpAudienceId ) {
    const isForAllPages = ( !cmpAudienceId || cmpAudienceId === '--NONE--' );
    const isTargetPageAudience = ( this.targetAudience && cmpAudienceId === this.targetAudience );
    console.debug( `--->>> DynLoadManager::checkPageAudience: isInBuilder=${this.isInBuilder}; isForAllPages=${isForAllPages}; isTargetPageAudience=${isTargetPageAudience};`);
    return ( this.isInBuilder || isForAllPages || isTargetPageAudience );
  }

  checkComponentAudiences( cmpsIdArray ) {
    const cmps = cmpsIdArray.map( id => this.componentsById.get( id ) );
    const cmpsToShow = cmps.map( c => {
      console.debug( `--->>> DynLoadManager::checkComponentAudiences: cmpsToShow => c:`, JSON.stringify( c ) );
      const isPageAudience = this.checkPageAudience( c.pageAudience );
      const isCompAudience = this.checkAudienceRules( c.compAudience );
      console.debug( `--->>> DynLoadManager::checkComponentAudiences: cmpId=${c.cmpId} pageAudience=${c.pageAudience}; compAudience=${c.compAudience}`);
      if ( isPageAudience && isCompAudience) {
        return c.cmpId;
      }
      else {
        return null;
      }
    }).filter( c => c != null );
    return cmpsToShow;
  }

  showOrHideComponentsByPageAudience( audienceValue, showNow ) {
    const audience = (audienceValue === VIEW_TARGET_PAGE_AUDIENCE_OPT) ? 
      this.targetAudience
      :
      audienceValue;
    const cmps = audience === VIEW_ALL_OPT ? 
      Array.from( this.componentsById.values() )
      :
      this.componentsByPageAudience.get( audience );
      if ( cmps && cmps.length > 0 ) {
        const ids = cmps.map(c=>c.cmpId);
        console.debug( `--->>> DynLoadManager::showOrHideComponentsByPageAudience: ids: `, JSON.stringify( ids ), "; showNow: " + showNow );
        this.sendMessage( MESSAGE_FACTORY.DYN_CMP_BUILDER_CHG_VISIBILITY( ids, showNow ) );
      }
  }

  handlePageAudiencesViewChange( event ) {
    const pageAudienceToShow = event.detail.value;

    // 1. send events to all previously visible components
    this.showOrHideComponentsByPageAudience( this.selectedPageAudience, false );
    // 2. show compoents for the selected page audience
    this.showOrHideComponentsByPageAudience( pageAudienceToShow, true );
    // 3. save selected pageAudience
    this.selectedPageAudience = pageAudienceToShow; 
  }
}



const flattenObject = (obj, parentKey = '', result = new Map()) => {
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = parentKey ? `${parentKey}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        flattenObject(obj[key], newKey, result);
      } else {
        result.set(newKey, obj[key]);
      }
    }
  }
  return result;
}

const dataBySObjectTypeToMap = (data) => {
  const result = new Map();
  for (let key in data) {
    if (data.hasOwnProperty(key)) {
      const items = data[key];
      const itemMap = new Map();
      items.forEach(item => {
        flattenObject(item, '', itemMap);
      });
      result.set(key, itemMap);
    }
  }
  return result;
}

const consoleDebugContext = ( methodName, ctxt ) => {
  const context = {
    Profile: ctxt.Profile,
    Permission: ctxt.Permission ? [...ctxt.Permission] : null,
    Location: ctxt.Location,
    Role: ctxt.Role,
    Domain: ctxt.Domain,
    Data: mapToString(ctxt.Data),
  };

  return context;
}

const mapDeepToString = (map) => {
  const obj = {};
  for (const [key, value] of map) {
    if (value instanceof Map) {
      obj[key] = mapDeepToString(value);
    } else {
      obj[key] = value !== null && value !== undefined ? value.toString() : String(value);
    }
  }
  return obj;
}

const mapToString = (map) => {
    return JSON.stringify(mapDeepToString(map));
}

