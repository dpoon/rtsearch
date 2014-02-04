// Copyright 2006, 2014 The University of British Columbia and Derek Poon
// Released under the Mozilla Public License, v2.0.

// This function replaces createSearchTermsWithList(...) in
// messenger.jar!content/messenger/searchBar.js of Thunderbird 1.0.
//
// It is copied verbatim from Thunderbird 2.0 (almost identical to 1.5), to
// override the existing function in Thunderbird 1.0, which does not call
// getScopeToUse(...).
function createSearchTermsWithList(aTermsArray)
{
  var nsMsgSearchScope = Components.interfaces.nsMsgSearchScope;
  var nsMsgSearchAttrib = Components.interfaces.nsMsgSearchAttrib;
  var nsMsgSearchOp = Components.interfaces.nsMsgSearchOp;

  gSearchSession.clearScopes();
  var searchTerms = gSearchSession.searchTerms;
  var searchTermsArray = searchTerms.QueryInterface(Components.interfaces.nsISupportsArray);
  searchTermsArray.Clear();

  var i;
  var selectedFolder = GetThreadPaneFolder();
  var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                  .getService(Components.interfaces.nsIIOService);

  var termsArray = aTermsArray.QueryInterface(Components.interfaces.nsISupportsArray);

  if (gXFVirtualFolderTerms)
  {
    var msgDatabase = selectedFolder.getMsgDatabase(msgWindow);
    if (msgDatabase)
    {
      var dbFolderInfo = msgDatabase.dBFolderInfo;
      var srchFolderUri = dbFolderInfo.getCharPtrProperty("searchFolderUri");
      viewDebug("createSearchTermsWithList xf vf scope = " + srchFolderUri + "\n");
      var srchFolderUriArray = srchFolderUri.split('|');
      for (i in srchFolderUriArray) 
      {
        var realFolderRes = GetResourceFromUri(srchFolderUriArray[i]);
        var realFolder = realFolderRes.QueryInterface(Components.interfaces.nsIMsgFolder);
        if (!realFolder.isServer)
          gSearchSession.addScopeTerm(getScopeToUse(termsArray, realFolder, ioService.offline), realFolder);
      }
    }
  }
  else
  {
    viewDebug ("in createSearchTermsWithList, adding scope term for selected folder\n");
    gSearchSession.addScopeTerm(getScopeToUse(termsArray, selectedFolder, ioService.offline), selectedFolder);
  }

  // add each item in termsArray to the search session
  for (i = 0; i < termsArray.Count(); ++i)
    gSearchSession.appendTerm(termsArray.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgSearchTerm));
}

// This function replaces getScopeToUse(...) in
// messenger.jar!content/messenger/searchBar.js of Thunderbird 1.5.
//
// It is mostly copy-and-pasted from Thunderbird 1.5 / 2.0.  We could try
// to override the existing function, but it is easier just to copy-and-paste
// the whole function, since we already do that for createSearchTerms()
// below anyway.
function getScopeToUse(aTermsArray, aFolderToSearch, aIsOffline)
{
  if (aIsOffline || aFolderToSearch.server.type != 'imap')
    return nsMsgSearchScope.offlineMail;

  var scopeToUse = gSearchInput && gSearchInput.searchMode == kQuickSearchBody && !gSearchInput.showingSearchCriteria
                   ? nsMsgSearchScope.onlineMail : nsMsgSearchScope.offlineMail;

  // it's possible one of our search terms may require us to use an online mail scope (such as imap body searches)
  for (var i = 0; scopeToUse != nsMsgSearchScope.onlineMail && i < aTermsArray.Count(); i++)
    if (aTermsArray.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgSearchTerm).attrib == nsMsgSearchAttrib.Body
        /* ************************************************************
         * BEGIN RTSEARCH MODIFICATION
         * ************************************************************ */
        || aTermsArray.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgSearchTerm).attrib >= nsMsgSearchAttrib.OtherHeader
        /* ************************************************************
         * END RTSEARCH MODIFICATION
         * ************************************************************ */
       )
      scopeToUse = nsMsgSearchScope.onlineMail;

  return scopeToUse;
}

// This function replaces createSearchTerms() in
// messenger.jar!content/messenger/searchBar.js.
//
// Unfortunately, it is almost entirely copy-and-pasted from Thunderbird 1.0 /
// 1.5 / 2.0, since there is no simple way to add just the required code to the
// existing function.  The modification lies between the "BEGIN" and "END"
// comments.
function createSearchTerms()
{
  var nsMsgSearchScope = Components.interfaces.nsMsgSearchScope;
  var nsMsgSearchAttrib = Components.interfaces.nsMsgSearchAttrib;
  var nsMsgSearchOp = Components.interfaces.nsMsgSearchOp;

  // create an i supports array to store our search terms 
  var searchTermsArray = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
  var selectedFolder = GetThreadPaneFolder();

  var searchAttrib = (IsSpecialFolder(selectedFolder, MSG_FOLDER_FLAG_SENTMAIL | MSG_FOLDER_FLAG_DRAFTS | MSG_FOLDER_FLAG_QUEUE, true)) ? nsMsgSearchAttrib.ToOrCC : nsMsgSearchAttrib.Sender;
  // implement | for QS
  // does this break if the user types "foo|bar" expecting to see subjects with that string?
  // I claim no, since "foo|bar" will be a hit for "foo" || "bar"
  // they just might get more false positives
  if (!gSearchInput.showingSearchCriteria) // ignore the text box value if it's just showing the search criteria string
  {
    var termList = gSearchInput.value.split("|");
    for (var i = 0; i < termList.length; i ++)
    {
      // if the term is empty, skip it
      if (termList[i] == "")
        continue;

      // create, fill, and append the subject term
      var term;
      var value;

      // if our search criteria is subject or subject|sender then add a term for the subject
      if (gSearchInput.searchMode == kQuickSearchSubject || gSearchInput.searchMode == kQuickSearchSenderOrSubject)
      {
        term = gSearchSession.createTerm();
        value = term.value;
        value.str = termList[i];
        term.value = value;
        term.attrib = nsMsgSearchAttrib.Subject;
        term.op = nsMsgSearchOp.Contains;
        term.booleanAnd = false;
        searchTermsArray.AppendElement(term);
      }

      if (gSearchInput.searchMode == kQuickSearchBody)
      {
        // what do we do for news and imap users that aren't configured for offline use?
        // in these cases the body search will never return any matches. Should we try to 
        // see if body is a valid search scope in this particular case before doing the search?
        // should we switch back to a subject/sender search behind the scenes?
        term = gSearchSession.createTerm();
        value = term.value;
        value.str = termList[i];
        term.value = value;
        term.attrib = nsMsgSearchAttrib.Body;
        term.op = nsMsgSearchOp.Contains; 
        term.booleanAnd = false;
        searchTermsArray.AppendElement(term);       
      }

      // create, fill, and append the sender (or recipient) term
      if (gSearchInput.searchMode == kQuickSearchSender || gSearchInput.searchMode == kQuickSearchSenderOrSubject)
      {
        term = gSearchSession.createTerm();
        value = term.value;
        value.str = termList[i];
        term.value = value;
        term.attrib = searchAttrib;
        term.op = nsMsgSearchOp.Contains; 
        term.booleanAnd = false;
        searchTermsArray.AppendElement(term);

        /* ************************************************************
         * BEGIN RTSEARCH MODIFICATION
         * ************************************************************ */
        term = gSearchSession.createTerm();
        value = term.value;
        value.str = termList[i];
        term.value = value;
        term.attrib = 1 + nsMsgSearchAttrib.OtherHeader;
        term.arbitraryHeader = 'RT-Originator';
        term.op = nsMsgSearchOp.Contains;
        term.booleanAnd = false;
        searchTermsArray.AppendElement(term);
      }

      // Thunderbird 1.0 doesn't have kQuickSearchRecipient
      if (typeof kQuickSearchRecipient != 'undefined')
        /* ************************************************************
         * END RTSEARCH MODIFICATION
         * ************************************************************ */
      // create, fill, and append the recipient
      if (gSearchInput.searchMode == kQuickSearchRecipient)
      {
        term = gSearchSession.createTerm();
        value = term.value;
        value.str = termList[i];
        term.value = value;
        term.attrib = nsMsgSearchAttrib.ToOrCC;
        term.op = nsMsgSearchOp.Contains; 
        term.booleanAnd = false;
        searchTermsArray.AppendElement(term);
      }

    }
  }

  // now append the default view or virtual folder criteria to the quick search   
  // so we don't lose any default view information
  viewDebug("gDefaultSearchViewTerms = " + gDefaultSearchViewTerms + "gVirtualFolderTerms = " + gVirtualFolderTerms + 
    "gXFVirtualFolderTerms = " + gXFVirtualFolderTerms + "\n");
  var defaultSearchTerms = (gDefaultSearchViewTerms || gVirtualFolderTerms || gXFVirtualFolderTerms);
  if (defaultSearchTerms)
  {
    var isupports = null;
    var searchTerm; 
    var termsArray = defaultSearchTerms.QueryInterface(Components.interfaces.nsISupportsArray);
    for (i = 0; i < termsArray.Count(); i++)
    {
      isupports = termsArray.GetElementAt(i);
      searchTerm = isupports.QueryInterface(Components.interfaces.nsIMsgSearchTerm);
      searchTermsArray.AppendElement(searchTerm);
    }
  }
  
  createSearchTermsWithList(searchTermsArray);
  
  // now that we've added the terms, clear out our input array
  searchTermsArray.Clear();
}
