/* 
 * Application loading
 *
 * universal functions
 * 
 */

var nextPageReq;

/* Minor utility to get a callback that puts apps */
function LoadAppsCallback(app_list)
{
	/* First rule of this callback: no modification to app_list itself (ok to modify children) ; that's due to async safety */
	return function(data)
	{		
		var collection = $();
		linvoapp_server.each(data.Application, function(index,app) { collection = collection.add(GetAppElement(app)); });
		collection.appendTo(app_list.css("opacity",0).fadeTo("slow",1)).each(TruncateAppDesc);
	};
}

/* A function to be called when 
 * 
 * a) we need to load applications from a specific category/filter
 * b) we need to load more applications from that category/filter, in which case we call it without arguments
 * c) searching: pass "search: blah blah"
 * 
 * */
function LoadApps(which_apps)
{
	var app_set = which_apps || LoadApps.last;

	if (filters[app_set])
		LoadApps.loadapps_func = LoadAppsFiltered;
	else if (app_set && app_set.split(":")[0] == "search")
		LoadApps.loadapps_func = LoadAppsSearched;
	else
		LoadApps.loadapps_func = LoadAppsByCategory;

	/* if which_apps is null, just bring the last one */
	if (!which_apps)
		which_apps = LoadApps.last;
	else
	{
		/* start with a blank page if we're changing what we're displaying */
		LoadApps.loadapps_func.page = 0;
		LoadApps.last = which_apps;
	}

	if (!which_apps) /* just a double-check, in case the last has not been set - we have not run the function with a category before */
		return;

	LoadApps.loadapps_func(which_apps);
	LoadApps.loadapps_func.page++; /* flip to next page */
}

/*
 * A function to reset the category 
 * 
 */
function LoadAppsResetCategory()
{
	LoadApps.last = null;
	delete linvoapp_server.baseParameters.Category;
}

/* 
 * Function to reset the filter
 * and the search bar
 * 
 * */
function LoadAppsResetFilter()
{
	LoadApps.loadapps_func = LoadAppsByCategory;
	LoadApps.last = linvoapp_server.baseParameters.Category;
	delete linvoapp_server.baseParameters.StartWith;
}

function LoadAppsResetSearch()
{
	delete linvoapp_server.baseParameters.SearchBy;
	
	LoadApps.loadapps_func = LoadAppsByCategory;
	LoadApps.last = linvoapp_server.baseParameters.Category;
}

/* 
 * Those functions save their requests in a object named
 * nextPageReq, and append every request to that object,
 * so basically they both have one queue for server requests
 * */
LoadAppsFiltered.page = 0;
function LoadAppsFiltered(filter)
{
	var query = {Page: LoadAppsFiltered.page, Limit: apps_per_page};
	$.extend(linvoapp_server.baseParameters,filters[filter].server_query); /* Add what's specific to the filter to the base server query */

	if (LoadAppsFiltered.page == 0)
	{
		/* If this is the first filtered page, try resuming app loading from the last app that we have loaded*/
		linvoapp_server.baseParameters.StartWith = $(".applications-list:visible").not(".filter-added").children().last().data("id"); 
		if (!linvoapp_server.baseParameters.StartWith) delete linvoapp_server.baseParameters.StartWith; /* Unless there wasn't a last app */
	}
	
	var app_list = $($.create("div",{class: "applications-list filter-added"}))
		.appendTo("#applications");
	
	nextPageReq = linvoapp_server.List(query, LoadAppsCallback(app_list)).ApplyAfter(nextPageReq);
}

LoadAppsByCategory.page = 0;
function LoadAppsByCategory(category)
{
	/* If this is called we should reset the filters' page */
	LoadAppsFiltered.page = 0;
	linvoapp_server.baseParameters.Category = category;

	if (LoadAppsByCategory.page == 0) /* Update the filter buttons if we're loading the first page */
		UpdateFilters();
	
	/* Check if the last loaded page of this category is empty */
	var pages =  $(".applications-list[id|="+category+"]");
	if (pages.length && !pages.last().children().length)
		return;
		
	/* If this DIV already exists, just show it */
	var div_id = category+"-"+LoadAppsByCategory.page;
	var app_list = document.getElementById(div_id);
	if (app_list)
	{
		$(app_list).fadeIn("slow");
		return;
	}

	app_list = $($.create("div",{class: "applications-list", id: div_id}))
		.appendTo("#applications");
	
	nextPageReq = linvoapp_server.List({Page: LoadAppsByCategory.page, Limit: apps_per_page}, LoadAppsCallback(app_list)).ApplyAfter(nextPageReq);
}

/* This function is a little more complex:
 * 
 * it is called on every keystroke in the search bar,
 * so it has to terminate the pending search request and 
 * start a new one
 * It also caches app elements so it doesn't have to call simpleweld (via GetAppElement) multiple times
 * 
 * */
LoadAppsSearched.page=0;
function LoadAppsSearched(searchby)
{		
	if (searchby.match("^search:"))
		searchby = searchby.substr(("search:").length);

	linvoapp_server.baseParameters.SearchBy = searchby;

	if (request)
		request.abort();
	
	if (!search_applist)
		search_applist = $(".searched-apps");
	
	request = linvoapp_server.List({PlainList: true, Limit: max_search_query+1},function(loaded_apps)
	{		
		var searchResultsElem = $("#search-results").show();
		searchResultsElem.find(".result-number").text(loaded_apps.length < max_search_query ? loaded_apps.length : max_search_query);
	
		var to_show;
		if (loaded_apps.length == 0) to_show = "#no-results";
		else if (loaded_apps.length == 1) to_show = "#one-result";
		else if (loaded_apps.length > max_search_query) to_show = "#more-than-limit";
		else to_show = "#many-results";
		searchResultsElem.find(to_show).show().siblings().hide();

		function putSearchResults()
		{
			search_applist.empty().show();
			var collection = $();
			$.each(search_lastapps,function(index, app_id)
			{
				collection = collection.add(searchCache[app_id]);
			});
			collection.appendTo(search_applist).each(TruncateAppDesc);
		}	

		/* First, find the uncached app elements */
		var uncachedApps = [];
		$.each(loaded_apps, function(index, app_id)
		{
			if (!searchCache[app_id])
				uncachedApps.push(app_id);
		});
		search_lastapps = loaded_apps;
		
		/* If there are any uncached apps, issue a request to the server to get them */
		if (uncachedApps.length)
		{
			requst = linvoapp_server.List({ID: loaded_apps.join(";")},function(data)
			{
				linvoapp_server.each(data.Application, function(index,app) { searchCache[app["@attributes"].id] = GetAppElement(app); });
				putSearchResults();
			}).Apply();
		}
		else
			putSearchResults();
	}).Apply();

	if (LoadAppsSearched.page==0)
		UpdateFilters();
}
