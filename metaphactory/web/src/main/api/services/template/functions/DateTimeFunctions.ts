/*
 * Copyright (C) 2015-2017, metaphacts GmbH
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

import * as moment from 'moment';

import { TemplateScope } from 'platform/api/services/template';

export function register(scope: TemplateScope) {
  /**
   * Date-time formating function. Default format is
   * "Month name, day of month, year  - e.g September 4 1986"
   * It is possible to use any format supported by moment.js,
   * see http://momentjs.com/docs/#/displaying/ for more details.
   */
  scope.registerHelper('dateTimeFormat', function (dateTime, format) {
    if (typeof format !== 'string') {
      format = 'LL';
    }
    return moment(dateTime).format(format);
  });
}
