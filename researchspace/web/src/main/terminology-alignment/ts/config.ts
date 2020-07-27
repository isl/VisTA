/*
 * Copyright (C) 2015-2017, © Trustees of the British Museum
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, you can receive a copy
 * of the GNU Lesser General Public License from http://www.gnu.org/
 */

//search for nodes  
export const rootsQuery = `
    prefix skos: <http://www.w3.org/2004/02/skos/core#>
              PREFIX gvp: <http://vocab.getty.edu/ontology#>
              PREFIX xl: <http://www.w3.org/2008/05/skos-xl#>

   select distinct ?item ?label ?hasChildren where {
     {
       ?item a ?type.
       #filter(?type = gvp:Concept || ?type = gvp:GuideTerm || ?type = gvp:Hierarchy )
              filter (?type =gvp:Facet)
       MINUS { ?item gvp:broaderGeneric ?parent }
       OPTIONAL { ?item gvp:prefLabelGVP [xl:literalForm ?label] }
     }
     OPTIONAL {
       ?child gvp:broaderGeneric ?item .
       #?child a gvp:Concept .
     }
     BIND(bound(?child) as ?hasChildren)
   } order by ?label
  `;

export const childrenQuery = `
 prefix skos: <http://www.w3.org/2004/02/skos/core#>
                 PREFIX gvp: <http://vocab.getty.edu/ontology#>
                 PREFIX xl: <http://www.w3.org/2008/05/skos-xl#>
                 
   select distinct ?item ?label ?hasChildren where {
     {
       ?item a ?type.
      filter(?type = gvp:Concept || ?type = gvp:GuideTerm || ?type = gvp:Hierarchy || ?type= gvp:Facet)
       ?item gvp:broaderGeneric ?parent
       OPTIONAL { ?item gvp:prefLabelGVP [xl:literalForm ?label] }
     }
     OPTIONAL {
       ?child gvp:broaderGeneric ?item .
       #?child a gvp:Concept .
     }
     BIND(bound(?child) as ?hasChildren)
   } order by ?label
  `;

export const parentsQuery = `
   prefix skos: <http://www.w3.org/2004/02/skos/core#>
                PREFIX gvp: <http://vocab.getty.edu/ontology#>
                PREFIX xl: <http://www.w3.org/2008/05/skos-xl#>

   select distinct ?item ?parent ?parentLabel where {
     {
       ?item a ?type.
      filter(?type = gvp:Concept || ?type = gvp:GuideTerm || ?type = gvp:Hierarchy || ?type= gvp:Facet)
       ?item gvp:broaderGeneric ?parent
       OPTIONAL { ?parent gvp:prefLabelGVP [xl:literalForm ?parentLabel] }
     }
   } order by ?parentLabel
  `;

export const searchQuery = `
   prefix bds: <http://www.bigdata.com/rdf/search#>
prefix skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX gvp: <http://vocab.getty.edu/ontology#>
PREFIX xl: <http://www.w3.org/2008/05/skos-xl#>
prefix hint: <http://www.bigdata.com/queryHints#>
SELECT distinct ?item ?score ?label ?hasChildren WHERE {
 {
   select distinct ?item ?score ?label ?hasChildren where {
     {
       SELECT ?concept ?conceptLabel ?conceptScore {
         SERVICE <http://www.bigdata.com/rdf/search#search> {
           ?conceptLabel bds:search  ?__token__ ;
                                           bds:relevance ?conceptScore .
         }
         ?concept a ?type.
         filter(?type = gvp:Concept || ?type = gvp:GuideTerm || ?type = gvp:Hierarchy || ?type= gvp:Facet)
         ?concept gvp:prefLabelGVP [xl:literalForm ?conceptLabel]
       }
     }
     {
       ?concept gvp:broaderGeneric ?parent .
       ?item gvp:broaderGeneric ?parent .
       OPTIONAL { ?item gvp:prefLabelGVP [xl:literalForm ?label] }
     
     OPTIONAL {
       ?child gvp:broaderGeneric ?item .
       #?child a gvp:Concept .
     }
     BIND(bound(?child) as ?hasChildren)
       BIND (0.6 as ?score).
     } UNION {
       BIND(?concept as ?item) .
       BIND(?conceptLabel as ?label) .
       BIND(?conceptScore as ?score) .
     }
     hint:Prior hint:runLast true .
   }
 }
  
 FILTER(BOUND(?item)).
 
} order by ?score
  `;


//present into hierarchy 


export const hierarchyRootsQuery = `
    prefix skos: <http://www.w3.org/2004/02/skos/core#>
             PREFIX gvp: <http://vocab.getty.edu/ontology#>
             PREFIX xl: <http://www.w3.org/2008/05/skos-xl#>

  select distinct ?item ?label ?hasChildren where {
    {
      ?item a ?type.
			#VALUES ?type {gvp:Concept gvp:GuideTerm gvp:Hierarchy}
			VALUES ?type {gvp:Facet}
      MINUS { ?item gvp:broaderGeneric ?parent }
      OPTIONAL { ?item gvp:prefLabelGVP [xl:literalForm ?label] }
    }
    OPTIONAL {
      ?child gvp:broaderGeneric ?item .
      #?child a gvp:Concept .
    }
    BIND(bound(?child) as ?hasChildren)
  } order by ?label
  `;




///////////////////////////////////

export const hierarchyQuery = `
    prefix skos: <http://www.w3.org/2004/02/skos/core#>
                  PREFIX gvp: <http://vocab.getty.edu/ontology#>
                  PREFIX xl: <http://www.w3.org/2008/05/skos-xl#>

    select distinct ?parent ?node ?label ?hasChildren where {
      {
        VALUES ?type {gvp:Concept gvp:GuideTerm}
        ?node a ?type.
        ?node gvp:broaderGeneric ?parent .
        OPTIONAL { ?node gvp:prefLabelGVP [xl:literalForm ?label] }
      }
      OPTIONAL {
        ?child gvp:broaderGeneric ?node .
        #?node a gvp:Concept .
      }
      BIND(bound(?child) as ?hasChildren)
    } order by ?label
  `;

export const hierarchyRootsQueryDEL = `
    prefix skos: <http://www.w3.org/2004/02/skos/core#>
                  PREFIX gvp: <http://vocab.getty.edu/ontology#>
                  PREFIX xl: <http://www.w3.org/2008/05/skos-xl#>

    select distinct ?parent ?node ?label ?hasChildren where {
      {
        VALUES ?type {gvp:Concept gvp:GuideTerm}
        ?node a ?type.
        ?node gvp:broaderGeneric ?parent .
        OPTIONAL { ?node gvp:prefLabelGVP [xl:literalForm ?label] }
      }
      OPTIONAL {
        ?child gvp:broaderGeneric ?node .
        #?node a gvp:Concept .
      }
      BIND(bound(?child) as ?hasChildren)
    } order by ?label
limit 20
  `;
