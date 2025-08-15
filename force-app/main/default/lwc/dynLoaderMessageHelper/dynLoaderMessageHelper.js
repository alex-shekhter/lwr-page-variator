export const TOPICS = Object.freeze({
  // DynComponentLoader send this event once it is ready to work with manager or like a respopnse to DYN_IS_CMP_AVAILABLE message
  DYN_CMP_REGISTER: "DYN_CMP_REGISTER",
  // DynComponentLoader send this event to the DynLoadingManager when it's become visible on the screen
  DYN_CMP_VISIBLE: "DYN_CMP_VISIBLE",
  // DynLoadingManager send this event to the dyn components to tell tham that it is available and they can register
  DYN_CMP_IS_AVAILABLE: "DYN_CMP_IS_AVAILABLE",
  // Manager sends this event to tell components if they can be loaded or not
  DYN_CMP_CMD_SHOW: "DYN_CMP_CMD_SHOW",
  // Manager sends this event to tell components to change visibility when running inside the Builder
  DYN_CMP_BUILDER_CHG_VISIBILITY: "DYN_CMP_BUILDER_CHG_VISIBILITY",
  // PAGE Audience changed event send from the DynComponentLoader to the DynLoadingManager when audience changed  
  DYN_CMP_PAGE_AUDIENCE_CHANGED: "DYN_CMP_PAGE_AUDIENCE_CHANGED",
  // DynCompopnentLoader removed from the Builder send this event to the DynLoadManager
  DYN_CMP_REMOVED_FROM_BUILDER: "DYN_CMP_REMOVED_FROM_BUILDER"
});

export const MESSAGE_FACTORY = Object.freeze({
  /**
   * Prepares registration message to be send to DynLoadManager from individual DynComponentLoader 
   * 
   * @param {DynComponentLoader} dynCmpLoaderInstance - instance of the DynComponentLoader 
   * @returns {object} prepared message to be send to DynLoadManager 
   */
  [TOPICS.DYN_CMP_REGISTER]: ( dynCmpLoaderInstance ) => ({ 
    topic: TOPICS.DYN_CMP_REGISTER,
    payload: {
      cmpId: dynCmpLoaderInstance.componentId,
      pageAudience: dynCmpLoaderInstance.pageAudience,
      compAudience: dynCmpLoaderInstance.compAudience,
      loadMode: dynCmpLoaderInstance.loadingMode,
      loadingOrder: dynCmpLoaderInstance.loadingOrder
    }
  }),
  /**
   * Prepares message to be send to DynLoadManager to tell that component is visible on the screen
   * 
   * @param {DynComponentLoader} dynCmpLoaderInstance 
   * @returns {object} message ready to send to DynLoadManager
   */
  [TOPICS.DYN_CMP_VISIBLE]: ( dynCmpLoaderInstance ) => ({ 
    topic: TOPICS.DYN_CMP_VISIBLE,
    payload: {
      cmpId: dynCmpLoaderInstance.componentId,
      pageAudience: dynCmpLoaderInstance.pageAudience,
      compAudience: dynCmpLoaderInstance.compAudience,
      loadMode: dynCmpLoaderInstance.loadingMode,
      loadingOrder: dynCmpLoaderInstance.loadingOrder
    }
  }),
  /**
   * Prepares component availability message to be send to DynComponentLoader from DynLoadManager
   * 
   * @param {string || array} targetCmp = "*" to all components or "cmpId" to specific component or array [cmpId1,cmpId2,cmpId3] to specific components
   * @returns {object} message ready to send to DynComponentLoader(s)
   */
  [TOPICS.DYN_CMP_IS_AVAILABLE]: ( targetCmp ) => ({
    topic: TOPICS.DYN_CMP_IS_AVAILABLE,
    payload: {
      targetCmp: targetCmp
    }
  }),
  /**
   * Prepares command to show component from the BynLoadManager to DynLoaderComponent(s)
   * 
   * @param {string || array} = "*" to all components or "cmpId" to specific component or array [cmpId1,cmpId2,cmpId3] to specific components
   * @param {boolean} showNow  true to show / false to hide
   * @returns {object} message ready to send to DynComponentLoader(s)
   */
  [TOPICS.DYN_CMP_CMD_SHOW]: ( targetCmp, showNow ) => ({
    topic: TOPICS.DYN_CMP_CMD_SHOW,
    payload: {
      targetCmp: targetCmp,
      showNow: showNow
    }
  }),
  /**
   * Prepares command to show or hide components inside the Builder
   * 
   * @param {string || array} targetCmp - = "*" to all components or "cmpId" to specific component or array [cmpId1,cmpId2,cmpId3] to specific components
   * @param {*} showOrHide true to show / false to hide
   * @returns {object} message ready to send to DynComponentLoader(s)
   */
  [TOPICS.DYN_CMP_BUILDER_CHG_VISIBILITY]: ( targetCmp, showOrHide ) => ({
    topic: TOPICS.DYN_CMP_BUILDER_CHG_VISIBILITY,
    payload: {
      targetCmp: targetCmp,
      showNow: showOrHide
    }
  }),
  /**
   * 
   * @param {DynComponentLoader} dynComponentLoaderInstance 
   * @returns {object} message ready to send to DynLoadManager
   */
  [TOPICS.DYN_CMP_PAGE_AUDIENCE_CHANGED]: ( dynComponentLoaderInstance ) => ({
    topic: TOPICS.DYN_CMP_PAGE_AUDIENCE_CHANGED,
    payload: {
      cmpId: dynComponentLoaderInstance.componentId,
      pageAudience: dynComponentLoaderInstance.pageAudience,
    }
  }),
  /**
   * Prepares message to be send to DynLoadManager to tell that component is removed from the Builder
   * 
   * @param {DynComponentLoader} dynComponentLoaderInstance 
   * @returns {object} message ready to send to DynLoadManager
   */
  [TOPICS.DYN_CMP_REMOVED_FROM_BUILDER]: ( dynComponentLoaderInstance ) => ({
    topic: TOPICS.DYN_CMP_REMOVED_FROM_BUILDER,
    payload: {
      cmpId: dynComponentLoaderInstance.componentId,
    }
  }),
});
